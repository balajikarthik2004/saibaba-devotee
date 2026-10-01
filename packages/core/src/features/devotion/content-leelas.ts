import type { Leela } from '../../types'

/**
 * Short leelas — original summaries of well-known episodes from Baba's life, written for
 * this platform. They are not translations of any published text. Temples can replace or
 * extend them from the admin CMS (Devotion → Content).
 */
const L = (
  n: number,
  title: string,
  theme: Leela['theme'],
  summary: string,
  featured = false,
): Leela => ({
  id: `leela_${String(n).padStart(2, '0')}`,
  title,
  theme,
  summary,
  language: 'en',
  readMinutes: Math.max(1, Math.round(summary.split(/\s+/).length / 140)),
  featured,
  publishedAt: '2026-01-15',
  source: 'Original summary written for this platform',
})

export const LEELA_SEED: Leela[] = [
  L(
    1,
    'Dwarakamai and the ever-burning dhuni',
    'guru-grace',
    'Baba made his home in a crumbling old mosque at Shirdi and named it Dwarakamai, a name that borrows from Krishna’s Dwaraka. Its walls were cracked and its roof leaked, yet it became the warmest place in the village. In one corner he kept a fire, the dhuni, and it was never allowed to go out. Visitors left with a pinch of its ash, udi, and many spoke of finding relief after taking it with trust. Baba never treated the ash as a product. He gave it the way a parent gives a child something small and ordinary, and the faith of the receiver did the rest. The fire is still tended today.',
    true,
  ),
  L(
    2,
    'Shraddha and Saburi: faith and patience',
    'faith-and-patience',
    'Devotees often say that Baba asked for only two things, and that they were worth more than any offering: shraddha, a steady trust, and saburi, the patience to wait without complaint. Shraddha is believing that the guide is walking beside you even when the road is dark. Saburi is not sitting idle. It is continuing to do the next right thing while the answer takes its own time. Baba would sometimes ask a devotee for dakshina of a few coins and, in the telling, the two coins became a picture of these two qualities. The lesson is gentle and practical: begin with trust, then let time do its slow work, and do not measure your worth by how quickly things change.',
    true,
  ),
  L(
    3,
    'Two coins of dakshina',
    'faith-and-patience',
    'Baba sometimes asked visitors for dakshina, a small money gift. Strangely, he asked mostly from people who had some to spare, and he would turn away those who were truly poor. What he collected did not stay with him. By evening it had been handed to beggars, to the needy, or to people building something useful for the village. Those close to him understood that the request was less about the coins and more about loosening the hold that wealth has on the heart. Some devotees found that a request for two small coins arrived exactly when they had been clinging to something, and giving it lightly felt like setting down a bag they had carried too long.',
  ),
  L(
    4,
    'Food for everyone who came',
    'service',
    'Baba loved to see people fed. On certain days he would cook a large pot of rice or sweet khichdi in the open, stirring it with his own hands, and then serve all who had gathered, without asking who they were or where they were from. He taught that no one should leave a holy place hungry, and that one who feeds a stranger with a clear heart has done the highest worship. He sometimes scolded those who sat down to a feast while someone outside waited. Many temples that follow his name keep a free meal, annadanam, for this reason. It is the simplest way of keeping the lesson alive.',
    true,
  ),
  L(
    5,
    'Bhiksha and the hungry animals',
    'compassion',
    'Each day Baba walked to a few houses in Shirdi and asked for bread, which he called bhiksha. Whatever he received, he carried back to the mosque and shared with the stray dogs, the crows, and anyone who happened to be there. He ate only a little himself. Villagers noticed that the household he visited felt blessed, and that the animals never seemed afraid of him. This humble habit carried a large message: a person who has almost nothing can still make room for others, and every living creature is owed a share. It also reminded people that giving to a hungry creature is itself a prayer, needing no temple and no priest.',
  ),
  L(
    6,
    'Lamps lit with water',
    'faith-and-patience',
    'In the early days, Baba used to light small oil lamps in the mosque and in the nearby temples. The local oil seller, tired of giving oil for free, one evening told him there was none left. Baba did not argue. He simply took water in his cup, poured it into the clay lamps, and lit them. They burned all night. The next morning the shopkeeper came to ask forgiveness. The telling is meant as a story about trust more than about a miracle to be explained: when a person’s purpose is to give light to others, the usual obstacles seem to lose their power. The oil seller went on to become one of his loyal friends.',
  ),
  L(
    7,
    'Mhalsapati gives him his name',
    'guru-grace',
    'When the young fakir first came to the edge of Shirdi, he stopped near the temple of Khandoba. Mhalsapati, the temple priest, saw him approaching and greeted him with the words “Ya Sai,” welcome, Sai. The name stayed. Mhalsapati grew into one of Baba’s closest companions and lived a modest life, sometimes sleeping in the mosque alongside him in the evenings. He never claimed credit for naming the saint, nor for the many quiet hours he spent in his company. The story is loved because it shows that the most enduring titles are often given simply and without ceremony, and that a warm welcome can be the start of something that lasts a lifetime.',
  ),
  L(
    8,
    'One Master for all',
    'unity',
    'Baba’s mosque hosted Hindu and Muslim festivals side by side. The fire of the dhuni burned beside the recitation of prayers from both traditions, and devotees from different backgrounds sat together on the same floor. When people argued about whose path was higher, he would often answer with a short line that later became famous: Sabka Malik Ek, the Master of all is One. He did not ask anyone to leave their faith. He asked only that they practise it with love and sincerity. To this day, temples dedicated to him tend to welcome visitors of every background, and his name is spoken comfortably by people who share little else in common.',
    true,
  ),
  L(
    9,
    'Prayag at Baba’s feet',
    'guru-grace',
    'A devotee and singer of the holy stories, Das Ganu, once felt a strong desire to go to Prayag and bathe at the meeting of rivers. He came to ask Baba’s permission, and Baba answered kindly that there was no need to go so far, that Prayag was here. As Das Ganu bowed to touch his feet, a stream of water is said to have flowed from them, and the devotee wept with joy. The story is told not to impress but to point at something simple: what we travel far to find is often already near, in the company of one who has a pure heart. Whether or not one takes it literally, the meaning is the same. Sincerity brings the sacred within reach.',
  ),
  L(
    10,
    'Chand Patil’s lost mare',
    'guru-grace',
    'A villager named Chand Patil was searching for his lost mare in the countryside near Aurangabad, worn out and worried. Under a tree sat a fakir in a plain kafni who, without being asked, told him where to look. When the man wanted to smoke, the fakir pushed his tongs into the ground and a burning coal came out, and he pressed the earth again and water appeared to dampen a cloth. The mare was found just where the stranger had said. Moved, Chand Patil invited him to a wedding at Shirdi, and the same young fakir walked into the village there and stayed for the rest of his life.',
  ),
  L(
    11,
    'Nine coins for Laxmibai',
    'surrender',
    'Not long before Baba left his body, he called Laxmibai Shinde, who had served him faithfully for years, and placed coins in her hands, nine in all. Devotees interpret them as a reminder of the nine ways of loving God described in the old texts, such as listening, singing, remembering, serving and surrender. Laxmibai did not treat the coins as wealth. She kept them as a blessing and as a quiet instruction about how to live: keep the heart turned towards the Lord in every small way available to you. The gift reminds us that the most precious inheritance from a saint is not property but a way of being.',
  ),
  L(
    12,
    'A fakir’s simple belongings',
    'surrender',
    'Baba owned almost nothing: a plain long robe called a kafni, a cloth tied round his head, a clay pipe, a tin pot, and a worn seat in the mosque. Visitors were sometimes surprised that a person with so little could draw so many. Gifts came in and went out again in the course of a day. He did not refuse what people brought in love, but he did not hold on to it either. By living with so little and so lightly, he quietly taught that contentment is not something we acquire. It is something we practise each morning, by wanting what is already enough.',
  ),
  L(
    13,
    'Bhagoji Shinde and the healing touch',
    'compassion',
    'Bhagoji Shinde suffered from leprosy and was shunned by many. Baba did not turn him away. He kept Bhagoji close, allowed him to tend the dhuni and to sit near him at the aarti, and treated him with ordinary affection. Devotees later remembered that the man’s dignity returned long before any relief from his illness. The story is often told to remind people that healing begins with being treated as a person and not as a problem. Baba’s way with Bhagoji asks us to look closely at who we have quietly stepped away from, and to consider whether a little warmth from us might be the medicine they need.',
  ),
  L(
    14,
    'The Gurusthan under the neem tree',
    'guru-grace',
    'On the outskirts of Shirdi stands a neem tree with a simple platform beneath it. Baba once pointed to the spot and said, in his quiet way, that his Guru rested there. He asked that incense be burned each Thursday and Friday. People noticed that the bitter neem leaves near that place seemed mild, and visitors sit there to this day. Baba rarely spoke of his own teacher in any detail, and this silence is itself part of the story. He wanted attention placed on the path, not on himself. Devotees light a lamp at the Gurusthan on Thursdays in remembrance of a lineage of humility that is older than any of us.',
  ),
]
