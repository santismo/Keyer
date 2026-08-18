/*
 * Keyer / Jazz solo-study catalog.
 *
 * Charlie Parker entries point to the MIT-licensed Charlie Parker Aligned
 * Omnibook dataset by Xavier Riley and Simon Dixon. The Miditar list is a
 * checked index of files that contain at least 1.8 complete chart forms, so
 * learners can move beyond the opening melody and study later choruses.
 */
(function attachKeyerJazzSoloCatalog(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KeyerJazzSoloCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildJazzSoloCatalog() {
  'use strict';

  var PARKER_DATASET_URL = 'https://huggingface.co/datasets/xavriley/CharlieParkerAlignedOmnibook';
  var PARKER_MIDI_BASE_URL = PARKER_DATASET_URL + '/resolve/main/midi_original/';

  function normalizeTitle(value) {
    var source = String(value || '').replace(/\\/g, '/').split('/').pop() || '';
    try { source = decodeURIComponent(source); } catch (_) {}
    if (typeof source.normalize === 'function') source = source.normalize('NFKD');
    return source
      .replace(/\.(?:mid|midi)$/i, '')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’‘`]/g, "'")
      .replace(/&/g, ' and ')
      .replace(/(?:\s|^)(?:arrangement|arr\.?|version|ver\.?|take)\s*#?\s*\d+\s*$/i, ' ')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .toLowerCase()
      .trim()
      .replace(/^(?:the|an|a)\s+/, '')
      .replace(/\s+/g, ' ');
  }

  function parkerSolo(standardTitle, soloTitle, fileName) {
    return Object.freeze({
      type: 'parker-solo',
      title: standardTitle,
      standardTitle: standardTitle,
      soloTitle: soloTitle,
      name: 'Charlie Parker — ' + soloTitle + '.mid',
      urls: [PARKER_MIDI_BASE_URL + encodeURIComponent(fileName) + '?download=true'],
      sourceLabel: 'Charlie Parker Aligned Omnibook · MIT',
      sourceUrl: PARKER_DATASET_URL
    });
  }

  var parkerSolos = Object.freeze([
    parkerSolo('Anthropology', 'Anthropology', '3zn4c.mid'),
    parkerSolo('Au Privave', 'Au Privave', 'rCn4c.mid'),
    parkerSolo('Barbados', 'Barbados', '1p64c.mid'),
    parkerSolo("Billie's Bounce", "Billie's Bounce", 'Q6Ryc.mid'),
    parkerSolo('Bloomdido', 'Bloomdido', 'WG3yc.mid'),
    parkerSolo('Blues For Alice', 'Blues For Alice', 'Qrqyc.mid'),
    parkerSolo('Cheryl', 'Cheryl', 't66yc.mid'),
    parkerSolo('Confirmation', 'Confirmation', 'yp3wc.mid'),
    parkerSolo('Dewey Square', 'Dewey Square', '6Cbwc.mid'),
    parkerSolo('Diverse', 'Diverse', '73bwc.mid'),
    parkerSolo('Donna Lee', 'Donna Lee', 'cXbwc.mid'),
    parkerSolo('Ko Ko', 'Ko Ko', 'tCfYc.mid'),
    parkerSolo('Moose The Mooche', 'Moose The Mooche', 'BRfYc.mid'),
    parkerSolo('My Little Suede Shoes', 'My Little Suede Shoes', 'LRfYc.mid'),
    parkerSolo("Now's The Time", "Now's The Time", 'PRfYc.mid'),
    parkerSolo("Now's The Time", "Now's The Time · alternate take", '9RfYc.mid'),
    parkerSolo('Ornithology', 'Ornithology', 'KRfYc.mid'),
    parkerSolo('Passport', 'Passport', 'xRfYc.mid'),
    parkerSolo('Perhaps', 'Perhaps', 'QRfYc.mid'),
    parkerSolo('Scrapple From The Apple', 'Scrapple From The Apple', 'tRfYc.mid'),
    parkerSolo('Segment', 'Segment', 'gRfYc-lower.mid'),
    parkerSolo("Shaw 'Nuff", "Shaw 'Nuff", 'GRfYc.mid'),
    parkerSolo('Si Si', 'Si Si', 'rRfYc.mid'),
    parkerSolo('Thriving From A Riff', 'Thriving From A Riff', 'SRfYc.mid'),
    parkerSolo('Yardbird Suite', 'Yardbird Suite', 'D3fYc.mid'),
    // These are Parker contrafacts; Keyer supplies their documented standard
    // form as the audible backing chart while the named Parker solo is shown.
    parkerSolo('I Got Rhythm', 'Chasing The Bird', 'nvJyc.mid'),
    parkerSolo('I Got Rhythm', 'Red Cross', 'nRfYc.mid'),
    parkerSolo('I Got Rhythm', 'Steeplechase', 'mRfYc.mid'),
    parkerSolo('Honeysuckle Rose', 'Marmaduke', '3RfYc.mid'),
    parkerSolo('Au Privave', 'Au Privave · alternate take', 'Nqn4c.mid')
  ]);

  var multiChorusTitles = "502 Blues|52nd Street Theme|A Beautiful Friendship|A Child Is Born|A Felicidade|A Fine Romance|A Night In Tunisia|A Sunday Kind Of Love|African Flower|Afro Blue|After You've Gone|Afternoon In Paris|Ain't Misbehavin'|Airegin|Alice In Wonderland|All Blues|All My Tomorrows|All Of Me|All Of You|All The Things You Are|Alone Together|Always|Am I Blue?|Ana Maria|Angel Eyes|Anthropology|Anything Goes|April In Paris|April Joy|Armageddon|Ask Me Now|Au Privave|Autumn In New York|Autumn Leaves|Ba-lue Bolivar Ba-lues-are|Beautiful Love|Beauty And The Beast|Bemsha Swing|Besame Mucho|Bessie's Blues|Bewitched|Big Nick|Billy Boy|Black Narcissus|Blue Bossa|Blue Monk|Blue Moon|Blue Skies|Blueberry Hill|Blues For Alice|Bluesette|Body And Soul|Boplicity|Born To Be Blue|Bright Mississippi|Bright Size Life|Brilliant Corners|But Beautiful|But Not For Me|Bye Bye Blackbird|Bye-Ya|Can't We Be Friends|Ceora|Charleston|Cherokee|Come Sunday|Confirmation|Coral|Corcovado|Cotton Tail|Could It Be You|Countdown|Criss Cross|Cry Me A River|Crystal Silence|Daahoud|Dancing On The Ceiling|Danny Boy|Darn That Dream|Dear Old Stockholm|Dearly Beloved|Deed I Do|Deep Purple|Deluge|Desafinado|Dexterity|Do Nothin' Til You Hear From Me|Dolores|Dolphin Dance|Don't Blame Me|Don't Get Around Much Anymore|Donna Lee|Dream|E.S.P.|Easy Living|Eighty One|El Gaucho|Embraceable You|Epistrophy|Equinox|Eronel|Everything I Have Is Yours|Evidence|Exactly Like You|Fall|Falling Grace|Fascinating Rhythm|Fascination|Fee-Fi-Fo-Fum|Feel Like Makin' Love|Feels So Good|Fly Me To The Moon|Fools Rush In|Footprints|For Heaven's Sake|Forest Flower|Four|Four On Six|Frenesi|Georgia On My Mind|Get Me To The Church On Time|Girl Talk|Gloria's Step|God Bless The Child|Grand Central|Groovin' High|Hackensack|Half Nelson|Hello|Hello Dolly|Here's That Rainy Day|Hey There|Honeysuckle Rose|House Of Jade|How About You|How High The Moon|How Insensitive|How Long Has This Been Going On?|I Can't Give You Anything But Love|I Could Have Danced All Night|I Cover The Waterfront|I Cried For You|I Got Rhythm|I Hear A Rhapsody|I Left My Heart In San Francisco|I Let A Song Go Out Of My Heart|I Mean You|I Remember Clifford|I Remember You|I Should Care|I Thought About You|I Will Wait For You|I Wish You Love|I Won't Dance|I'll Be Around|I'll Be Seeing You|I'll Never Smile Again|I'll Remember April|I'm A Fool To Want You|I'm All Smiles|I'm Getting Sentimental Over You|I'm In The Mood For Love|I've Got A Crush On You|I've Grown Accustomed To Her Face|If You Could See Me Now|Imagination|Impressions|In a Sentimental Mood|In Walked Bud|Inner Urge|Invitation|Isn't It Romantic?|Israel|It Could Happen To You|It Don't Mean A Thing|It Had To Be You|It's Impossible|It's Only a Paper Moon|It's You Or No One|Jackie-ing|Jinrikisha|Jordu|Joy Spring|Just Friends|Just In Time|Lady Bird|Laura|Lazy Bird|Let's Cool One|Like A Lover|Like Someone In Love|Limehouse Blues|Little Rootie Tootie|Long Ago And Far Away|Look To The Sky|Lover Man|Lucky Southern|Lullaby Of Birdland|Lulu's Back In Town|Mahjong|Maiden Voyage|Make Someone Happy|Manhattan|Mean To Me|Meditation|Memories Of You|Midnight Sun|Misty|Miyako|Moment's Notice|Monk's Mood|Mood Indigo|Moon River|Moonglow|Moonlight In Vermont|Moose The Mooche|More Than You Know|Mr. P.C.|My Favorite Things|My Foolish Heart|My Heart Belongs To Daddy|My Little Suede Shoes|My Old Flame|My One And Only Love|My Romance|My Shining Hour|My Ship|Naima|Nature Boy|Nefertiti|New York, New York|Nica's Dream|Night Dreamer|No Moon At All|Off Minor|Oleo|On A Clear Day|On A Slow Boat To China|On Broadway|On Green Dolphin Street|On The Street Where You Live|On The Sunny Side Of The Street|Once I Loved|Once In A While|One By One|One Note Samba|Ornithology|Out Of Nowhere|Pannonica|Peace|Pennies From Heaven|Pensativa|Perdido|Peri's Scope|Pick Yourself Up|Played Twice|Poinciana|Portrait Of Jennie|Prelude To A Kiss|Put On A Happy Face|Quiet Now|Recado Bossa Nova|Red Top|Reflections|Rhythm-a-ning|Rosetta|Round Midnight|Route 66|Ruby, My Dear|S'posin'|Satin Doll|Scrapple From The Apple|Sentimental Journey|September Song|Shiny Stockings|Since I Fell For You|Smoke Gets In Your Eyes|So What|Softly, As In A Morning Sunrise|Solar|Solitude|Some Other Time|Someday My Prince Will Come|Someday You'll Be Sorry|Sophisticated Lady|Soul Eyes|Speak Low|Speak No Evil|Spring Is Here|Star Eyes|Stella By Starlight|Stolen Moments|Stompin' At The Savoy|Straight No Chaser|Strangers In The Night|Summertime|Tangerine|Tenderly|There Is No Greater Love|There Will Never Be Another You|There's A Small Hotel|These Foolish Things|They All Laughed|Think Of One|This Masquerade|Till There Was You|Time After Time|Unit Seven|Wave|We'll Be Together Again|Well You Needn't|What's New|When Sunny Gets Blue|Yesterdays|You Are Too Beautiful|You Don't Know What Love Is|You Took Advantage Of Me|You've Changed".split('|');
  var multiChorusKeys = new Set(multiChorusTitles.map(normalizeTitle));

  return Object.freeze({
    parkerSolos: parkerSolos,
    parkerDatasetUrl: PARKER_DATASET_URL,
    findParkerSolos: function findParkerSolos(title) {
      var key = normalizeTitle(title);
      return parkerSolos.filter(function find(entry) { return normalizeTitle(entry.standardTitle) === key; });
    },
    findParkerSolo: function findParkerSolo(title) {
      var key = normalizeTitle(title);
      return parkerSolos.find(function find(entry) { return normalizeTitle(entry.standardTitle) === key; }) || null;
    },
    isMiditarMultiChorus: function isMiditarMultiChorus(title) {
      return multiChorusKeys.has(normalizeTitle(title));
    },
    multiChorusCount: multiChorusKeys.size
  });
});
