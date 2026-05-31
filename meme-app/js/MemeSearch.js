var MemeGen = window.MemeGen || {};

/**
 * MemeSearch
 *
 * Combines two template sources into one searchable grid:
 *   1. Popular meme templates from Imgflip's public `get_memes` endpoint
 *      (no API key required for read-only access).
 *   2. The project's own internal library from assets/templates/templates.json.
 *
 * Both lists are fetched once, merged, and cached, then filtered client-side
 * by name (and, for internal templates, also by character/emotion/tags) — no
 * per-keystroke network calls. Selecting a result invokes the onSelect
 * callback with the chosen template so the host app can load it onto the canvas.
 */
MemeGen.MemeSearch = (function () {
  var ENDPOINT = 'https://api.imgflip.com/get_memes';

  // index.html lives in meme-app/, while templates.json + its images live in
  // the sibling assets/ folder, so the repo-root-relative paths in the JSON
  // need a leading "../" when loaded from the page.
  var TEMPLATES_PATH = '../assets/templates/templates.json';
  var ASSET_PREFIX = '../';

  // Cached templates and fetch state.
  var memes = [];
  var fetched = false;
  var fetching = false;

  // DOM references and callback set during init().
  var inputEl = null;
  var resultsEl = null;
  var statusEl = null;
  var onSelectCallback = null;

  /**
   * Wire up the search UI.
   *  opts.input    — text input element
   *  opts.results  — container element that will hold the result cards
   *  opts.status   — element used for loading / empty / error messages
   *  opts.onSelect — function(meme) called when a result card is clicked
   */
  function init(opts) {
    inputEl = opts.input;
    resultsEl = opts.results;
    statusEl = opts.status;
    onSelectCallback = opts.onSelect || null;

    // Simple debounce so we don't re-render on every keystroke.
    var debounceTimer = null;
    inputEl.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSearch, 150);
    });

    // Enter triggers an immediate search.
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(debounceTimer);
        runSearch();
      }
    });

    // Fetch lazily on first focus so we don't slow initial page load.
    inputEl.addEventListener('focus', ensureFetched);
    ensureFetched();
  }

  // Fetch the Imgflip list and the internal library once, merge, and cache.
  // Imgflip is the primary source: if it fails we surface an error. The local
  // library is best-effort — if it can't be loaded we just omit it.
  function ensureFetched() {
    if (fetched || fetching) return;
    fetching = true;
    setStatus('Loading memes…');

    Promise.all([fetchImgflipMemes(), fetchLocalTemplates()])
      .then(function (lists) {
        // Imgflip's popular memes first, then the internal library after them.
        memes = lists[0].concat(lists[1]);
        fetched = true;
        fetching = false;
        setStatus('');
        runSearch();
      })
      .catch(function (err) {
        fetching = false;
        setStatus('Could not load memes: ' + err.message);
      });
  }

  // Imgflip templates: { id, name, url, ... } as returned by the endpoint.
  function fetchImgflipMemes() {
    return fetch(ENDPOINT)
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.success || !data.data || !data.data.memes) {
          throw new Error('Unexpected response shape');
        }
        return data.data.memes.map(toImgflipMeme);
      });
  }

  // Curated keyword tags for Imgflip's popular top-100 templates, keyed by the
  // numeric `id` Imgflip returns. Each entry holds the emotions / concepts /
  // common search terms a person might type when looking for that image — the
  // API itself returns no tags, so search would otherwise only match the name.
  // Stable list; if Imgflip rotates the popular set, missing ids gracefully
  // fall back to name-only matching.
  var IMGFLIP_ALIASES = {
    '181913649': ['approve', 'reject', 'prefer', 'choice', 'comparison', 'no', 'yes', 'like', 'dislike', 'rap', 'happy', 'disgusted', 'calm', 'confident', 'thoughtful', 'serious', 'hopeful', 'romantic', 'dreamy', 'playful', 'determined', 'relaxed'],
    '87743020':  ['choice', 'decision', 'dilemma', 'sweating', 'panic', 'hard choice', 'pressure', 'nervous', 'stressed', 'anxious', 'panicked', 'worried', 'overwhelmed', 'scared', 'thoughtful', 'hopeful', 'confused', 'frustrated'],
    '112126428': ['cheating', 'temptation', 'choice', 'comparison', 'jealousy', 'betrayal', 'interest', 'love', 'jealous', 'angry', 'disappointed', 'shocked', 'surprised', 'guilty', 'romantic', 'awkward', 'insecure', 'heartbroken', 'uncomfortable', 'worried'],
    '217743513': ['refuse', 'ultimatum', 'choice', 'defiance', 'stubborn', 'cards', 'game', 'angry', 'furious', 'frustrated', 'annoyed', 'disgusted', 'determined', 'serious'],
    '124822590': ['choice', 'swerve', 'drift', 'decision', 'regret', 'sudden change', 'exit', 'highway', 'panicked', 'surprised', 'frustrated', 'confused', 'scared', 'overwhelmed', 'determined'],
    '222403160': ['asking', 'plea', 'request', 'begging', 'politics', 'bernie', 'mittens', 'serious', 'determined', 'frustrated', 'hopeful', 'grateful', 'annoyed', 'furious', 'angry', 'screaming'],
    '131087935': ['escape', 'run away', 'avoid', 'flee', 'abandon', 'ignore', 'balloon', 'scared', 'panicked', 'sad', 'lonely', 'embarrassed', 'guilty', 'awkward'],
    '252600902': ['astronaut', 'betrayal', 'surprise', 'realization', 'conspiracy', 'shock', 'gun', 'space', 'shocked', 'surprised', 'confused', 'terrified', 'devastated', 'screaming', 'determined', 'suspicious'],
    '4087833':   ['waiting', 'patience', 'forever', 'slow', 'impatient', 'dead', 'bored', 'exhausted', 'lonely', 'sad', 'miserable', 'frustrated', 'annoyed', 'disappointed'],
    '131940431': ['plan', 'scheme', 'mistake', 'realization', 'regret', 'oops', 'minions', 'shocked', 'surprised', 'disappointed', 'guilty', 'confused', 'frustrated', 'embarrassed', 'thoughtful'],
    '135256802': ['agreement', 'alliance', 'teamwork', 'unity', 'friendship', 'common ground', 'predator', 'happy', 'joyful', 'excited', 'grateful', 'proud', 'confident', 'relieved', 'determined'],
    '97984':     ['evil', 'smirk', 'fire', 'chaos', 'mischief', 'satisfaction', 'kid', 'arson', 'happy', 'proud', 'confident', 'playful', 'calm', 'excited', 'joyful', 'ecstatic', 'determined', 'guilty'],
    '322841258': ['concern', 'worry', 'miscommunication', 'hopeful', 'dark', 'scary', 'awkward', 'silence', 'star wars', 'worried', 'scared', 'shocked', 'uncomfortable', 'serious', 'thoughtful', 'anxious', 'insecure', 'devastated', 'nervous'],
    '91538330':  ['everywhere', 'abundance', 'overwhelming', 'lots', 'many', 'surrounded', 'buzz lightyear', 'toy story', 'overwhelmed', 'surprised', 'shocked', 'exhausted', 'stressed', 'confused', 'panicked'],
    '80707627':  ['sad', 'lonely', 'waiting', 'depressed', 'bored', 'empty', 'pablo', 'heartbroken', 'devastated', 'miserable', 'exhausted', 'emotional', 'crying', 'bittersweet', 'nostalgic', 'shy'],
    '129242436': ['opinion', 'debate', 'prove', 'challenge', 'controversial', 'statement', 'steven crowder', 'serious', 'confident', 'determined', 'thoughtful', 'calm', 'suspicious'],
    '188390779': ['angry', 'yelling', 'argument', 'confused', 'fight', 'accusation', 'cat', 'dinner', 'furious', 'screaming', 'frustrated', 'annoyed', 'disgusted', 'awkward', 'uncomfortable'],
    '102156234': ['mocking', 'mimic', 'sarcasm', 'teasing', 'sarcastic', 'ridicule', 'spongebob', 'annoyed', 'disgusted', 'playful', 'laughing', 'bored'],
    '247375501': ['strong', 'weak', 'comparison', 'past', 'present', 'then now', 'evolved', 'doge', 'cheems', 'proud', 'confident', 'nostalgic', 'bittersweet', 'ecstatic', 'determined', 'jealous', 'disgusted'],
    '438680':    ['slap', 'hit', 'shut up', 'correct', 'dismiss', 'scold', 'interrupt', 'batman', 'robin', 'angry', 'annoyed', 'furious', 'frustrated', 'serious'],
    '93895088':  ['smart', 'evolution', 'levels', 'escalating', 'galaxy brain', 'enlightenment', 'big brain', 'thoughtful', 'confident', 'proud', 'ecstatic', 'excited'],
    '309868304': ['exchange', 'deal', 'swap', 'negotiate', 'business', 'offer', 'hopeful', 'thoughtful', 'suspicious', 'curious', 'grateful', 'confident'],
    '101470':    ['aliens', 'conspiracy', 'explanation', 'theory', 'why', 'mystery', 'history channel', 'confused', 'curious', 'suspicious', 'thoughtful', 'excited'],
    '55311130':  ['denial', 'fire', 'calm', 'disaster', 'ignore', 'accept', 'dog', 'burning', 'coffee', 'relaxed', 'peaceful', 'devastated', 'overwhelmed', 'stressed', 'anxious', 'exhausted', 'miserable', 'panicked', 'terrified', 'worried', 'relieved'],
    '178591752': ['fancy', 'classy', 'sophisticated', 'prefer', 'upgrade', 'refined', 'pooh', 'bear', 'happy', 'calm', 'peaceful', 'confident', 'proud', 'dreamy', 'romantic', 'grateful', 'relaxed', 'relieved', 'joyful'],
    '124055727': ['addicted', 'craving', 'want more', 'need more', 'desperate', 'drugs', 'excited', 'surprised', 'ecstatic', 'joyful', 'laughing', 'happy'],
    '180190441': ['same', 'identical', 'similar', 'no difference', 'oblivious', 'office', 'confused', 'serious', 'thoughtful', 'suspicious'],
    '505705955': ['cinema', 'masterpiece', 'beautiful', 'perfect', 'awe', 'glasses', 'movie', 'peaceful', 'ecstatic', 'emotional', 'joyful', 'dreamy', 'nostalgic', 'bittersweet', 'proud', 'grateful'],
    '61579':     ['boromir', 'impossible', 'difficult', 'lotr', 'lord of the rings', 'warning', 'mordor', 'serious', 'thoughtful', 'confident', 'determined'],
    '148909805': ['awkward', 'looking away', 'side eye', 'suspicious', 'uncomfortable', 'puppet', 'nervous', 'anxious', 'embarrassed', 'guilty', 'insecure', 'shy'],
    '100777631': ['confusion', 'misidentify', 'butterfly', 'wrong', 'anime', 'mistaken', 'confused', 'curious', 'hopeful', 'thoughtful'],
    '427308417': ['accident', 'mistake', 'simpsons', 'sign', 'counter', 'days without', 'lenny', 'disappointed', 'frustrated', 'embarrassed', 'annoyed'],
    '79132341':  ['self sabotage', 'blame', 'bike', 'stick', 'fail', 'accident', 'own fault', 'frustrated', 'awkward', 'guilty', 'embarrassed', 'devastated', 'miserable', 'exhausted', 'panicked', 'stressed', 'annoyed', 'furious'],
    '252758727': ['neglect', 'ignore', 'distracted', 'priorities', 'drowning', 'phone', 'mom', 'shocked', 'terrified', 'panicked', 'scared', 'worried', 'devastated', 'screaming', 'anxious', 'uncomfortable', 'guilty', 'surprised', 'stressed'],
    '224015000': ['asking', 'plea', 'begging', 'request', 'politics', 'bernie', 'sanders', 'hopeful', 'serious', 'awkward', 'shy', 'calm', 'grateful', 'relieved', 'uncomfortable', 'insecure'],
    '3218037':   ['empty', 'missing', 'lacking', 'regret', 'sad', 'would have', 'nothing', 'trophy', 'disappointed', 'jealous', 'bittersweet', 'embarrassed', 'heartbroken', 'miserable', 'awkward', 'devastated', 'dreamy', 'uncomfortable', 'crying', 'bored'],
    '177682295': ['surprised', 'unpaid', 'work', 'jealous', 'shocked', 'pirate', 'disappointed', 'awkward', 'uncomfortable', 'embarrassed'],
    '161865971': ['survived', 'avoided', 'escape', 'facebook', 'safe', 'crisis', 'relieved', 'grateful', 'calm', 'peaceful', 'hopeful', 'relaxed'],
    '195515965': ['fool', 'idiot', 'realization', 'denial', 'foolish', 'clown myself', 'embarrassed', 'guilty', 'insecure', 'awkward', 'disappointed', 'shy', 'disgusted'],
    '110163934': ['boyfriend', 'thinking', 'distracted', 'distant', 'sad', 'jealous', 'women', 'insecure', 'lonely', 'heartbroken', 'bittersweet', 'romantic', 'emotional', 'worried', 'thoughtful'],
    '370867422': ['nosy', 'suspicious', 'sneaky', 'peek', 'watching', 'lurk', 'megamind', 'curious', 'awkward', 'uncomfortable', 'playful', 'lonely', 'guilty', 'determined', 'confident', 'bored'],
    '84341851':  ['evil', 'temptation', 'dark side', 'mischievous', 'intrusive thoughts', 'kermit', 'frog', 'playful', 'confident', 'angry', 'furious', 'guilty'],
    '28251713':  ['giving', 'everyone', 'generous', 'gift', 'oprah', 'you get a', 'happy', 'ecstatic', 'joyful', 'excited', 'grateful', 'laughing', 'playful'],
    '67452763':  ['jealous', 'sad', 'watching', 'lonely', 'missing out', 'outside', 'squidward', 'spongebob', 'heartbroken', 'miserable', 'disappointed', 'bored', 'dreamy', 'bittersweet', 'emotional', 'uncomfortable', 'shy', 'crying', 'romantic'],
    '1035805':   ['meeting', 'suggestion', 'fired', 'thrown', 'business', 'idea', 'boardroom', 'window', 'surprised', 'shocked', 'awkward', 'serious', 'embarrassed', 'thoughtful', 'disappointed', 'overwhelmed', 'stressed'],
    '27813981':  ['fake smile', 'hiding', 'pain', 'awkward', 'sad inside', 'harold', 'old man', 'sad', 'miserable', 'exhausted', 'lonely', 'disappointed', 'bittersweet', 'emotional', 'insecure', 'uncomfortable', 'embarrassed', 'nostalgic', 'dreamy', 'frustrated', 'annoyed', 'scared', 'terrified', 'stressed', 'anxious', 'shy', 'heartbroken', 'devastated', 'romantic', 'crying', 'calm', 'worried'],
    '226297822': ['panic', 'calm', 'anxiety', 'stress', 'relief', 'panik', 'kalm', 'panicked', 'anxious', 'stressed', 'relieved', 'peaceful', 'nervous', 'scared', 'worried', 'overwhelmed'],
    '206151308': ['pointing', 'blame', 'identical', 'accusation', 'all same', 'copies', 'spiderman', 'confused', 'surprised', 'shocked', 'suspicious', 'playful', 'awkward', 'scared', 'nervous'],
    '155067746': ['surprised', 'shocked', 'predictable', 'obvious', 'astonished', 'pikachu', 'pokemon', 'scared', 'confused', 'ecstatic', 'laughing', 'curious'],
    '89370399':  ['smart', 'clever', 'thinking', 'logic', 'galaxy brain', 'tap head', 'roll safe', 'thoughtful', 'confident', 'calm', 'playful', 'relieved', 'determined', 'proud', 'relaxed'],
    '5496396':   ['cheers', 'toast', 'celebration', 'salute', 'gatsby', 'leonardo', 'dicaprio', 'happy', 'joyful', 'ecstatic', 'proud', 'confident', 'grateful', 'relaxed', 'romantic', 'peaceful', 'relieved', 'laughing'],
    '119139145': ['temptation', 'urge', 'smash', 'push', 'button', 'irresistible', 'nut', 'excited', 'determined', 'playful', 'panicked'],
    '163573':    ['imagine', 'fantasy', 'rainbow', 'imagination', 'picture this', 'spongebob', 'happy', 'peaceful', 'dreamy', 'playful', 'joyful', 'calm', 'excited', 'hopeful', 'relaxed', 'laughing', 'grateful', 'relieved'],
    '77045868':  ['negotiation', 'low offer', 'lowball', 'business', 'refuse', 'pawn', 'thoughtful', 'suspicious', 'annoyed', 'frustrated', 'serious', 'awkward', 'disappointed'],
    '533936279': ['average', 'intelligent', 'idiot', 'midwit', 'statistics', 'agreement', 'iq', 'thoughtful', 'confident', 'suspicious', 'curious', 'overwhelmed', 'determined'],
    '61520':     ['suspicious', 'unsure', 'confused', 'fry', 'futurama', "can't tell", 'thoughtful', 'curious'],
    '171305372': ['protect', 'guardian', 'sacrifice', 'dangerous', 'watching over', 'soldier', 'child', 'serious', 'determined', 'scared', 'lonely', 'worried', 'anxious', 'terrified', 'peaceful', 'emotional', 'grateful', 'dreamy', 'relieved'],
    '99683372':  ['sleeping', 'bored', 'uninterested', 'asleep', 'indifferent', 'shaq', 'basketball', 'exhausted', 'relaxed', 'peaceful', 'lonely', 'miserable', 'dreamy', 'calm', 'relieved'],
    '354700819': ['happy', 'sad', 'life', 'contrast', 'comparison', 'perspective', 'bus', 'window', 'lonely', 'peaceful', 'dreamy', 'bittersweet', 'hopeful', 'miserable', 'joyful', 'romantic', 'emotional', 'crying', 'nostalgic', 'jealous', 'heartbroken', 'grateful', 'calm', 'relaxed', 'relieved', 'devastated'],
    '114585149': ['yelling', 'screaming', 'loud', 'angry', 'seagull', 'shouting', 'inhale', 'furious', 'excited', 'ecstatic', 'joyful', 'laughing', 'frustrated', 'panicked', 'annoyed'],
    '259237855': ['laughing', 'funny', 'hilarious', 'leonardo', 'mocking', 'laugh', 'dicaprio', 'happy', 'joyful', 'ecstatic', 'playful', 'excited'],
    '166969924': ['repair', 'fix', 'cover up', 'hide problem', 'flex tape', 'phil swift', 'confident', 'determined', 'relieved'],
    '284929871': ['alone', 'party', 'lonely', 'isolated', 'social', 'awkward', 'secret', 'they dont know', 'jealous', 'shy', 'insecure', 'uncomfortable', 'sad', 'dreamy', 'bittersweet', 'romantic', 'miserable', 'emotional'],
    '129315248': ['refuse', 'accept', 'opposites', 'contradiction', 'change mind', 'kombucha', 'disgusted', 'surprised', 'confused', 'ecstatic', 'playful'],
    '101288':    ['confused', 'skeptical', "doesn't understand", 'kid', 'africa', 'suspicious', 'curious', 'awkward', 'uncomfortable', 'shy'],
    '316466202': ['confused', 'lost', 'searching', 'missing', 'where', 'monkey', 'puppet', 'curious', 'panicked', 'worried', 'lonely', 'surprised', 'awkward'],
    '119215120': ['pain', 'headache', 'comparison', 'types', 'suffering', 'chart', 'exhausted', 'stressed', 'overwhelmed', 'miserable', 'frustrated', 'uncomfortable', 'anxious'],
    '208915813': ['shock', 'news', 'surprise', 'disaster', 'history', 'bush', 'classroom', 'shocked', 'devastated', 'overwhelmed', 'terrified', 'serious', 'worried'],
    '137501417': ['betrayal', 'new friend', 'replaced', 'abandoned', 'end friendship', 'sad', 'angry', 'disappointed', 'heartbroken', 'jealous', 'bittersweet', 'miserable', 'lonely', 'emotional', 'awkward', 'devastated', 'nostalgic', 'confident', 'romantic', 'crying', 'insecure', 'shocked', 'determined'],
    '234202281': ['shock', 'surprise', 'scared', 'terror', 'wrestling', 'aj styles', 'undertaker', 'shocked', 'terrified', 'panicked', 'screaming', 'awkward', 'nervous'],
    '187102311': ['multiple', 'same', 'all agree', 'agreement', 'parallel', 'dragon', 'ghidorah', 'confident', 'determined', 'serious', 'suspicious', 'scared'],
    '221578498': ['defeat', 'loss', 'sad', 'dead', 'mourning', 'beaten', 'grave', 'flash', 'heartbroken', 'devastated', 'miserable', 'emotional', 'lonely', 'bittersweet', 'nostalgic', 'crying', 'disappointed', 'exhausted'],
    '309668311': ['choice', 'decision', 'fork', 'road', 'divergence', 'paths', 'crossroads', 'thoughtful', 'hopeful', 'confused', 'nervous', 'determined', 'dreamy', 'serious'],
    '101956210': ['fear', 'scared', 'whisper', 'creepy', 'ear', 'frightened', 'goosebumps', 'terrified', 'nervous', 'anxious', 'awkward', 'uncomfortable', 'worried'],
    '224514655': ['hiding', 'fear', 'scared', 'avoid', 'anime', 'terminator', 'girl', 'terrified', 'panicked', 'anxious', 'stressed', 'nervous', 'lonely', 'worried', 'shy', 'miserable', 'screaming', 'insecure', 'devastated', 'crying', 'uncomfortable'],
    '247113703': ['collision', 'surprise', 'attack', 'sudden', 'crash', 'devastate', 'train', 'bus', 'shocked', 'devastated', 'terrified', 'panicked', 'overwhelmed', 'screaming'],
    '61556':     ['old', 'confused', 'technology', 'granny', 'discovery', 'computer', 'curious', 'excited', 'surprised', 'nostalgic', 'awkward', 'proud'],
    '14371066':  ['wisdom', 'yoda', 'advice', 'judging', 'jedi', 'star wars', 'thoughtful', 'serious', 'calm', 'peaceful', 'confident', 'determined', 'suspicious', 'curious', 'dreamy', 'relieved', 'relaxed'],
    '135678846': ['accusation', 'blame', 'killed', 'who did this', 'guilt', 'hannibal', 'eric andre', 'shocked', 'surprised', 'guilty', 'confused', 'awkward', 'panicked'],
    '61544':     ['success', 'win', 'victory', 'achievement', 'baby', 'fist pump', 'kid', 'happy', 'joyful', 'ecstatic', 'proud', 'confident', 'excited', 'determined', 'grateful', 'relieved'],
    '216523697': ['friends', 'group', 'hate', 'opinion', 'dislike together', 'homies', 'angry', 'annoyed', 'disgusted', 'frustrated', 'confident', 'furious'],
    '21735':     ['looking back', 'shocked', 'surprised', 'side eye', 'driving', 'rock', 'dwayne', 'suspicious', 'serious', 'awkward', 'uncomfortable', 'annoyed', 'curious'],
    '123999232': ['truth', 'denial', 'rejection', 'throw away', 'reject reality', 'scroll', 'angry', 'disgusted', 'frustrated', 'disappointed', 'devastated', 'furious'],
    '91545132':  ['sign', 'announce', 'decree', 'declaration', 'executive order', 'trump', 'proud', 'confident', 'serious', 'determined', 'playful'],
    '371619279': ['single', 'lonely', 'alone', 'no friends', 'megamind', 'incel', 'shy', 'insecure', 'miserable', 'bittersweet', 'awkward', 'embarrassed', 'heartbroken', 'romantic', 'emotional', 'dreamy', 'frustrated', 'crying', 'sad', 'jealous'],
    '29617627':  ['captain', 'in charge', 'control', 'boss', 'power', 'attention', 'look at me', 'serious', 'confident', 'determined', 'shocked', 'surprised'],
    '110133729': ['accuse', 'blame', 'same', 'identical', 'copy', 'you too', 'spiderman', 'confused', 'suspicious', 'awkward', 'playful', 'surprised', 'annoyed'],
    '360597639': ['competition', 'opponent', 'rival', 'contest', 'vs', 'match', 'confident', 'proud', 'determined', 'playful', 'excited'],
    '142009471': ['wrong', 'confused', 'butterfly', 'anime', 'misidentify', 'curious', 'hopeful', 'thoughtful'],
    '6235864':   ['emotional', 'crying', 'sad', 'moved', 'peter pan', 'depp', 'tears', 'heartbroken', 'devastated', 'bittersweet', 'nostalgic', 'miserable', 'dreamy', 'lonely', 'grateful', 'peaceful', 'romantic', 'overwhelmed'],
    '145139900': ['reveal', 'expose', 'unmask', 'betrayal', 'scooby', 'identity', 'mask', 'shocked', 'surprised', 'suspicious', 'curious', 'awkward'],
    '72525473':  ['predictable', 'expected', 'simpsons', 'catchphrase', 'repeat', 'bart', 'annoyed', 'frustrated', 'embarrassed', 'awkward', 'bored'],
    '50421420':  ['disappointed', 'sad', 'let down', 'walking away', 'unimpressed', 'frustrated', 'annoyed', 'miserable', 'exhausted', 'bored', 'lonely', 'emotional', 'devastated', 'disgusted'],
    '101716':    ['yo dawg', 'recursive', 'nested', 'inside', 'xzibit', 'pimp my ride', 'playful', 'laughing', 'confident', 'nostalgic', 'proud'],
    '134797956': ['argument', 'fight', 'debate', 'yelling', 'conflict', 'dispute', 'chopper', 'angry', 'furious', 'screaming', 'frustrated', 'annoyed', 'stressed'],
    '162372564': ['chain reaction', 'consequence', 'sequence', 'cause and effect', 'domino', 'overwhelmed', 'surprised', 'shocked', 'panicked', 'devastated'],
    '29562797':  ['takeover', 'replace', 'boss', 'leader', 'captain phillips', 'somali', 'confident', 'determined', 'serious', 'proud', 'scared'],
    '92084495':  ['conspiracy', 'crazy', 'theory', 'always sunny', 'charlie', 'evidence', 'pepe silvia', 'anxious', 'panicked', 'stressed', 'overwhelmed', 'confused', 'suspicious', 'curious', 'exhausted', 'determined', 'thoughtful', 'nervous', 'terrified', 'frustrated', 'miserable', 'lonely', 'scared', 'screaming', 'crying', 'ecstatic', 'laughing'],
    '91998305':  ['drake', 'blank', 'template', 'choice', 'comparison', 'thoughtful', 'calm', 'playful', 'relaxed', 'bored'],
    '249257686': ['communist', 'share', 'ours', 'bugs bunny', 'ownership', 'mine', 'playful', 'confident', 'suspicious']
  };

  // Normalize an Imgflip API record into the same shape internal templates use,
  // so the search index treats both sources uniformly. searchText combines the
  // lowercased name with any curated alias keywords; entries with no aliases
  // still get name-based matching, matching prior behavior for that subset.
  function toImgflipMeme(raw) {
    var aliases = IMGFLIP_ALIASES[raw.id] || [];
    var text = (raw.name + ' ' + aliases.join(' ')).toLowerCase();
    return {
      id: raw.id,
      name: raw.name,
      url: raw.url,
      searchText: text
    };
  }

  // Internal-library templates, normalized to the same shape as Imgflip memes.
  // Best-effort: any failure resolves to an empty list so it never blocks the
  // Imgflip results from rendering.
  function fetchLocalTemplates() {
    return fetch(TEMPLATES_PATH)
      .then(function (response) {
        if (!response.ok) return [];
        return response.json();
      })
      .then(function (data) {
        return (Array.isArray(data) ? data : []).map(toMeme);
      })
      .catch(function () {
        return [];
      });
  }

  // Convert an internal template record into the meme shape used for rendering.
  // searchText bundles the extra metadata so internal templates can be matched
  // by character, emotion, or tag — not just by name.
  function toMeme(t) {
    return {
      id: t.id,
      name: t.name,
      url: resolveImageUrl(t.image),
      searchText: buildSearchText(t)
    };
  }

  function buildSearchText(t) {
    var parts = [t.name, t.character, t.emotion];
    if (Array.isArray(t.tags)) parts = parts.concat(t.tags);
    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  // encodeURI keeps "/" but escapes spaces and other unsafe characters so
  // filenames like "TAJ-weird smile.webp" resolve correctly.
  function resolveImageUrl(image) {
    return encodeURI(ASSET_PREFIX + image);
  }

  // Filter cached templates by the current query and render the grid.
  function runSearch() {
    if (!fetched) {
      ensureFetched();
      return;
    }
    var query = (inputEl.value || '').trim().toLowerCase();
    var filtered = query
      ? memes.filter(function (m) {
          var haystack = m.searchText || (m.name || '').toLowerCase();
          return haystack.indexOf(query) !== -1;
        })
      : memes;
    render(filtered);
  }

  // Build the result cards. Each card is a button so it's keyboard accessible.
  function render(list) {
    resultsEl.innerHTML = '';

    if (!list.length) {
      setStatus('No memes match your search.');
      return;
    }
    setStatus('');

    list.forEach(function (meme) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'meme-search-card';
      card.title = meme.name;

      var img = document.createElement('img');
      img.src = meme.url;
      img.alt = meme.name;
      img.loading = 'lazy';
      // Anonymous CORS so the image can be drawn to canvas without tainting.
      img.crossOrigin = 'anonymous';

      var label = document.createElement('span');
      label.className = 'meme-search-name';
      label.textContent = meme.name;

      card.appendChild(img);
      card.appendChild(label);
      card.addEventListener('click', function () {
        if (onSelectCallback) onSelectCallback(meme);
        scrollPageToTop();
      });

      resultsEl.appendChild(card);
    });
  }

  function scrollPageToTop() {
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  // Load a remote meme image onto the canvas via the existing ImageLoader.
  //
  // We fetch the image URL as a Blob and then hand it to ImageLoader.loadFromFile
  // (which internally uses FileReader.readAsDataURL — that accepts any Blob,
  // not just File objects). This avoids adding a URL-loading code path to
  // ImageLoader and reuses its existing canvas-sizing and callback logic.
  //
  // Using fetch (rather than setting <img>.src directly) means the request
  // goes through CORS and the resulting data URL is same-origin to the page,
  // so the canvas is not tainted and the download flow keeps working.
  function loadFromUrl(url, onError) {
    fetch(url, { mode: 'cors' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.blob();
      })
      .then(function (blob) {
        MemeGen.ImageLoader.loadFromFile(blob);
      })
      .catch(function (err) {
        if (typeof onError === 'function') onError(err);
      });
  }

  return {
    init: init,
    loadFromUrl: loadFromUrl
  };
})();

window.MemeGen = MemeGen;
