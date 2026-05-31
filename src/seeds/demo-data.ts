import {
  AgeRating,
  BookStatus,
  DistributionType,
  SelectionMethod,
} from '../books/enums';
import { ApplicationStatus, ReadingStatus } from '../applications/enums';
import { FriendStatus } from '../friends/enums';
import { ReviewType } from '../reviews/enums';
import { UserType } from '../users/enums';
import { ActivityType } from '../user-activity/enums';

const DAY = 24 * 60 * 60 * 1000;

export const daysFromNow = (days: number) =>
  new Date(Date.now() + days * DAY);

export const daysAgo = (days: number) =>
  new Date(Date.now() - days * DAY);

export type DemoAuthorSeed = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  bio: string;
};

export type DemoReaderSeed = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  bio: string;
  birthDate?: string;
};

export type DemoSeriesSeed = {
  authorUsername: string;
  name: string;
  description: string;
};

export type DemoApplicationSeed = {
  readerUsername: string;
  status: ApplicationStatus;
  message: string;
  readingStatus?: ReadingStatus;
  daysAgoResponded?: number;
  daysAgoCopySent?: number;
  daysAgoCopyReceived?: number;
  daysAgoReadingStarted?: number;
  daysAgoReadingCompleted?: number;
  daysAgoReviewSubmitted?: number;
  authorNotes?: string;
  review?: {
    rating: number;
    reviewType?: ReviewType;
    reviewContent?: string;
    reviewUrls?: string[];
    isPublic?: boolean;
  };
};

export type DemoBookSeed = {
  authorUsername: string;
  title: string;
  coverFile: string;
  shortDescription: string;
  fullDescription: string;
  ageRating: AgeRating;
  distributionType: DistributionType;
  selectionMethod: SelectionMethod;
  status: BookStatus;
  totalCopies: number;
  approvedCount: number;
  applicationDeadlineDaysFromNow: number;
  reviewDeadlineDaysFromNow?: number;
  seriesName?: string;
  seriesOrder?: number;
  pageCount: number;
  selectionCriteria?: string;
  lotteryRunDaysAgo?: number;
  publishedDaysAgo?: number;
  genres: string[];
  applications: DemoApplicationSeed[];
};

export const DEMO_AUTHORS: DemoAuthorSeed[] = [
  {
    username: 'sarah_author',
    email: 'sarah.author@example.com',
    firstName: 'Sarah',
    lastName: 'Johnson',
    bio: 'Fantasy and romantasy author. I love sending early copies to readers who enjoy immersive world-building and morally grey characters.',
  },
  {
    username: 'michael_writer',
    email: 'michael.writer@example.com',
    firstName: 'Michael',
    lastName: 'Chen',
    bio: 'Thriller and mystery writer obsessed with unreliable narrators, small-town secrets, and readers who notice every clue.',
  },
  {
    username: 'emma_novels',
    email: 'emma.novels@example.com',
    firstName: 'Emma',
    lastName: 'Williams',
    bio: 'YA and crossover fiction author. My ARC program focuses on passionate reviewers who love character-driven stories.',
  },
];

export const DEMO_READERS: DemoReaderSeed[] = [
  {
    username: 'alice_reader',
    email: 'alice.reader@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    bio: 'Fantasy reader | currently obsessed with fae courts and slow-burn romance.',
    birthDate: '1998-03-14',
  },
  {
    username: 'bob_bookworm',
    email: 'bob.bookworm@example.com',
    firstName: 'Bob',
    lastName: 'Martinez',
    bio: 'Sci-fi and thriller fan. I annotate everything and review within a week.',
    birthDate: '1995-07-22',
  },
  {
    username: 'charlie_reads',
    email: 'charlie.reads@example.com',
    firstName: 'Charlie',
    lastName: 'Brown',
    bio: 'Reads across genres. Always looking for my next five-star obsession.',
    birthDate: '2000-11-05',
  },
  {
    username: 'diana_loves_books',
    email: 'diana.books@example.com',
    firstName: 'Diana',
    lastName: 'Davis',
    bio: 'Romance and YA reader. BookTok made me do it.',
    birthDate: '2001-01-18',
  },
  {
    username: 'eve_reviews',
    email: 'eve.reviews@example.com',
    firstName: 'Eve',
    lastName: 'Wilson',
    bio: 'Honest reviewer with a soft spot for dark academia and murder mysteries.',
    birthDate: '1997-09-30',
  },
  {
    username: 'frank_fantasy',
    email: 'frank.fantasy@example.com',
    firstName: 'Frank',
    lastName: 'Petrov',
    bio: 'Epic fantasy reader from Sofia. I post weekly reading updates.',
    birthDate: '1994-06-12',
  },
  {
    username: 'grace_mystery',
    email: 'grace.mystery@example.com',
    firstName: 'Grace',
    lastName: 'Nguyen',
    bio: 'Mystery/thriller ARC hunter. If there is a twist, I will find it.',
    birthDate: '1999-04-08',
  },
  {
    username: 'henry_yaa',
    email: 'henry.yaa@example.com',
    firstName: 'Henry',
    lastName: 'Brooks',
    bio: 'YA reader and bookseller. I prioritize diverse voices and sharp dialogue.',
    birthDate: '2002-08-25',
  },
  {
    username: 'ivy_bookstagram',
    email: 'ivy.bookstagram@example.com',
    firstName: 'Ivy',
    lastName: 'Clark',
    bio: 'Bookstagrammer with 12k followers. Aesthetic reviews and mood boards.',
    birthDate: '1996-12-03',
  },
  {
    username: 'jack_reviewer',
    email: 'jack.reviewer@example.com',
    firstName: 'Jack',
    lastName: 'Turner',
    bio: 'Long-form reviewer. I care about pacing, prose, and satisfying endings.',
    birthDate: '1993-02-17',
  },
];

export const DEMO_SERIES: DemoSeriesSeed[] = [
  {
    authorUsername: 'sarah_author',
    name: 'Throne of Glass',
    description:
      'Sarah J. Maas’s epic fantasy saga following assassin Celaena Sardothien through courts, magic, and war.',
  },
  {
    authorUsername: 'emma_novels',
    name: 'Once Upon a Broken Heart',
    description:
      'A lush romantasy trilogy about bargains, heartbreak, and the dangerous magic of the Magnifico.',
  },
  {
    authorUsername: 'sarah_author',
    name: 'The Bridge Kingdom',
    description:
      'Political fantasy romance set in a kingdom traded away by marriage and defended by secrets.',
  },
  {
    authorUsername: 'michael_writer',
    name: 'The Inheritance Games',
    description:
      'Puzzle-box thrillers where Avery Kagan inherits a fortune she must earn through riddles and betrayal.',
  },
  {
    authorUsername: 'emma_novels',
    name: 'The Twisted Series',
    description:
      'Dark romantasy duology of stolen crowns, cursed islands, and enemies who refuse to stay apart.',
  },
];

const pending = (
  readerUsername: string,
  message: string,
): DemoApplicationSeed => ({
  readerUsername,
  status: ApplicationStatus.PENDING,
  message,
  readingStatus: ReadingStatus.NOT_STARTED,
});

const approvedReading = (
  readerUsername: string,
  message: string,
  days: number,
): DemoApplicationSeed => ({
  readerUsername,
  status: ApplicationStatus.APPROVED,
  message,
  readingStatus: ReadingStatus.CURRENTLY_READING,
  daysAgoResponded: days + 3,
  daysAgoCopySent: days + 2,
  daysAgoCopyReceived: days + 1,
  daysAgoReadingStarted: days,
});

const approvedForReview = (
  readerUsername: string,
  message: string,
  days: number,
): DemoApplicationSeed => ({
  readerUsername,
  status: ApplicationStatus.APPROVED,
  message,
  readingStatus: ReadingStatus.FOR_REVIEW,
  daysAgoResponded: days + 6,
  daysAgoCopySent: days + 5,
  daysAgoCopyReceived: days + 4,
  daysAgoReadingStarted: days + 3,
  daysAgoReadingCompleted: days,
});

const approvedReviewed = (
  readerUsername: string,
  message: string,
  days: number,
  review: DemoApplicationSeed['review'],
): DemoApplicationSeed => ({
  readerUsername,
  status: ApplicationStatus.APPROVED,
  message,
  readingStatus: ReadingStatus.REVIEWED,
  daysAgoResponded: days + 14,
  daysAgoCopySent: days + 13,
  daysAgoCopyReceived: days + 12,
  daysAgoReadingStarted: days + 10,
  daysAgoReadingCompleted: days + 5,
  daysAgoReviewSubmitted: days,
  review,
});

const rejected = (
  readerUsername: string,
  message: string,
  days: number,
  authorNotes: string,
): DemoApplicationSeed => ({
  readerUsername,
  status: ApplicationStatus.REJECTED,
  message,
  readingStatus: ReadingStatus.NOT_STARTED,
  daysAgoResponded: days,
  authorNotes,
});

const textReview = (
  rating: number,
  reviewContent: string,
  isPublic = true,
): DemoApplicationSeed['review'] => ({
  rating,
  reviewType: ReviewType.TEXT,
  reviewContent,
  isPublic,
});

const linkReview = (
  rating: number,
  reviewUrls: string[],
  reviewContent?: string,
  isPublic = true,
): DemoApplicationSeed['review'] => ({
  rating,
  reviewType: ReviewType.LINK,
  reviewUrls,
  reviewContent,
  isPublic,
});

export const DEMO_BOOKS: DemoBookSeed[] = [
  {
    authorUsername: 'sarah_author',
    title: 'Throne Of Glass',
    coverFile: 'Throne Of Glass.jpeg',
    shortDescription:
      'After a year in the salt mines, assassin Celaena Sardothien is offered freedom—if she wins a deadly tournament.',
    fullDescription:
      'Celaena Sardothien has survived slavery, training, and a king’s prison. Now she must compete against thieves, warriors, and killers for the title of royal champion. Every duel brings her closer to freedom, but the castle hides darker magic than anyone admits. Perfect for readers who love fierce heroines, court intrigue, and high-stakes fantasy.',
    ageRating: AgeRating.THIRTEEN_PLUS,
    distributionType: DistributionType.DIGITAL,
    selectionMethod: SelectionMethod.AUTHOR_SELECTS,
    status: BookStatus.ACTIVE,
    totalCopies: 12,
    approvedCount: 5,
    applicationDeadlineDaysFromNow: 21,
    reviewDeadlineDaysFromNow: 60,
    seriesName: 'Throne of Glass',
    seriesOrder: 1,
    pageCount: 404,
    selectionCriteria:
      'Looking for readers who enjoy epic fantasy, strong female leads, and can review within three weeks.',
    publishedDaysAgo: 14,
    genres: ['Fantasy', 'Young Adult'],
    applications: [
      pending(
        'alice_reader',
        'I have read the entire series twice and would love to write a thoughtful reread review for new readers.',
      ),
      pending(
        'frank_fantasy',
        'Epic fantasy is my main genre. I post weekly progress updates and always hit deadlines.',
      ),
      approvedReading(
        'bob_bookworm',
        'Huge fan of morally grey characters and tournament arcs.',
        4,
      ),
      approvedReviewed(
        'charlie_reads',
        'Finished the first half in two days—ready to write my review this weekend.',
        3,
        textReview(
          4.5,
          'Maas opens the series with incredible momentum. Celaena is fierce and funny, the tournament structure keeps every chapter tense, and the castle secrets hooked me immediately. Cannot wait to see where the romance and politics go next.',
        ),
      ),
      rejected(
        'henry_yaa',
        'I review YA fantasy on my blog and would love an ARC.',
        3,
        'Thank you for applying! We filled this round but hope to work with you on the next release.',
      ),
      pending(
        'grace_mystery',
        'I would cross-post my review to Goodreads and StoryGraph within two weeks.',
      ),
      approvedReading(
        'diana_loves_books',
        'Reread buddy read with a friend—we are halfway through the tournament.',
        6,
      ),
      approvedReviewed(
        'ivy_bookstagram',
        'Posted a spoiler-free video review on my channel.',
        5,
        linkReview(
          5,
          ['https://www.youtube.com/watch?v=seE0RjZ4qxc'],
          'Throne of Glass — spoiler-free BookTube review (Steven’s Book Reviews).',
        ),
      ),
      approvedForReview(
        'jack_reviewer',
        'Drafting a craft-focused review on tournament structure and POV tension.',
        2,
      ),
    ],
  },
  {
    authorUsername: 'michael_writer',
    title: "A Good Girl's Guide to Murder",
    coverFile: "A Good Girl's Guide to Murder.jpeg",
    shortDescription:
      'For her senior project, Pippa Fitz-Amobi reinvestigates a closed murder case—and uncovers secrets her town buried.',
    fullDescription:
      'Five years ago, Andie Bell was murdered by Sal Singh, who killed himself days later. Case closed. But Pippa cannot shake the inconsistencies in the evidence. Her podcast-style investigation pulls her into a maze of lies, small-town politics, and dangerous truths. Ideal for readers who love sharp mysteries with modern voice and propulsive pacing.',
    ageRating: AgeRating.THIRTEEN_PLUS,
    distributionType: DistributionType.DIGITAL,
    selectionMethod: SelectionMethod.FIRST_COME,
    status: BookStatus.ACTIVE,
    totalCopies: 15,
    approvedCount: 5,
    applicationDeadlineDaysFromNow: 18,
    reviewDeadlineDaysFromNow: 45,
    pageCount: 389,
    publishedDaysAgo: 10,
    genres: ['Mystery', 'Young Adult', 'Thriller'],
    applications: [
      pending('grace_mystery', 'Mystery ARCs are my specialty—I average 4 reviews per month.'),
      pending('henry_yaa', 'Our school book club would love discussion prompts in the review.'),
      pending('ivy_bookstagram', 'Planning a true-crime aesthetic reel series for this one.'),
      approvedReading(
        'eve_reviews',
        'True-crime podcast fan here. I will treat this like a serialized investigation.',
        3,
      ),
      approvedReading(
        'diana_loves_books',
        'Listening to the audiobook during commutes—almost at the midpoint twist.',
        4,
      ),
      approvedReviewed(
        'jack_reviewer',
        'Almost done and drafting a spoiler-free review focused on pacing and clues.',
        4,
        textReview(
          3.5,
          'Jackson nails the investigative rhythm—each clue feels discovered, not dumped. Pippa’s voice keeps the story grounded even when the plot goes wild. The ending lost me slightly, but mystery readers will still devour this.',
        ),
      ),
      approvedReviewed(
        'alice_reader',
        'This book absolutely destroyed me in the best way.',
        8,
        textReview(
          4.5,
          'Holly Jackson delivers a mystery that feels genuinely investigative rather than convenient. Pippa is a brilliant protagonist—curious without being reckless for plot’s sake. The town atmosphere is claustrophobic and perfect.',
        ),
      ),
      approvedReviewed(
        'bob_bookworm',
        'Video review is live on my channel.',
        6,
        linkReview(
          4,
          ['https://www.youtube.com/watch?v=1VFPl9XLKp4'],
          'A Good Girl’s Guide to Murder — Holly Jackson BookTube review.',
        ),
      ),
      approvedForReview(
        'charlie_reads',
        'One of my favorite YA mysteries this year—written review going up Sunday.',
        2,
      ),
      rejected(
        'frank_fantasy',
        'I read mostly fantasy but want to branch into mystery.',
        5,
        'This campaign prioritized established mystery reviewers—please apply to our next thriller!',
      ),
    ],
  },
  {
    authorUsername: 'emma_novels',
    title: 'The Hunger Games',
    coverFile: 'thehungergames.jpeg',
    shortDescription:
      'Katniss Everdeen volunteers for the Hunger Games, a televised fight to the death designed to keep the districts obedient.',
    fullDescription:
      'In Panem, the Capitol forces each district to send two tributes into the arena. When her sister is chosen, Katniss steps forward instead. Survival means performing for cameras, navigating alliances, and refusing to become what the Capitol wants. A cornerstone YA dystopian novel for readers who love high stakes and political undertones.',
    ageRating: AgeRating.THIRTEEN_PLUS,
    distributionType: DistributionType.BOTH,
    selectionMethod: SelectionMethod.LOTTERY,
    status: BookStatus.ACTIVE,
    totalCopies: 8,
    approvedCount: 0,
    applicationDeadlineDaysFromNow: -5,
    reviewDeadlineDaysFromNow: 40,
    pageCount: 374,
    publishedDaysAgo: 20,
    genres: ['Young Adult', 'Dystopian', 'Science Fiction'],
    applications: [
      pending(
        'diana_loves_books',
        'Rereading for a book club—I would love to facilitate discussion questions in my review.',
      ),
      pending(
        'henry_yaa',
        'Teaching adjacent reader here. I focus on theme and accessibility for teen audiences.',
      ),
      pending(
        'charlie_reads',
        'I have never read this classic and want to go in fresh with an honest review.',
      ),
      pending(
        'frank_fantasy',
        'Interested in comparing the book to popular media adaptations.',
      ),
      pending(
        'ivy_bookstagram',
        'Planning a tribute-inspired visual review series for my audience.',
      ),
      pending(
        'bob_bookworm',
        'I review quickly and can post within ten days of receiving the copy.',
      ),
      pending(
        'alice_reader',
        'Classic dystopian—I want to write a review comparing book vs film pacing.',
      ),
      pending(
        'eve_reviews',
        'Would include content notes and classroom discussion questions.',
      ),
      pending(
        'grace_mystery',
        'Never read this despite everyone recommending it—ready to finally dive in.',
      ),
      pending(
        'jack_reviewer',
        'Long-form reviewer interested in political themes and Katniss as protagonist.',
      ),
    ],
  },
  {
    authorUsername: 'michael_writer',
    title: 'Percy Jackson',
    coverFile: 'Percy Jackson.jpeg',
    shortDescription:
      'Percy Jackson discovers he is a demigod and must prevent a war among the gods of Olympus.',
    fullDescription:
      'Twelve-year-old Percy has always been trouble. After losing another school, he learns the truth: he is the son of Poseidon, and monsters want him dead. With friends Annabeth and Grover, he crosses America toward the Underworld to recover Zeus’s stolen master bolt. Perfect for readers who love fast adventure, humor, and modern mythology.',
    ageRating: AgeRating.ALL,
    distributionType: DistributionType.DIGITAL,
    selectionMethod: SelectionMethod.FIRST_COME,
    status: BookStatus.ACTIVE,
    totalCopies: 15,
    approvedCount: 7,
    applicationDeadlineDaysFromNow: 25,
    reviewDeadlineDaysFromNow: 50,
    pageCount: 377,
    publishedDaysAgo: 7,
    genres: ['Fantasy', 'Young Adult', "Children's"],
    applications: [
      pending('henry_yaa', 'Great pick for teen readers—I work with a youth reading group.'),
      pending('grace_mystery', 'My niece recommended this—I promised her a joint review.'),
      approvedReading('alice_reader', 'Reading aloud with my younger cousin and taking notes.', 2),
      approvedReading('diana_loves_books', 'Comfort reread! Excited to review with fresh eyes.', 5),
      approvedReading('frank_fantasy', 'Introductory mythology read before my fantasy book club month.', 3),
      approvedReviewed(
        'charlie_reads',
        'Just reached the Lotus Hotel chapter—review coming soon.',
        4,
        textReview(
          5,
          'Riordan makes mythology accessible without dumbing it down. Percy’s humor carries even the exposition-heavy chapters, and the quest structure is perfect for reluctant readers.',
        ),
      ),
      approvedReviewed(
        'ivy_bookstagram',
        'Posted my video review yesterday!',
        6,
        linkReview(
          4.5,
          ['https://www.youtube.com/watch?v=eJI3yC2_yHE'],
          'The Lightning Thief — spoiler-free Percy Jackson book review.',
        ),
      ),
      approvedForReview(
        'eve_reviews',
        'Shared a family read-along vlog—full write-up next.',
        3,
      ),
      approvedReading(
        'bob_bookworm',
        'Reading with my nephew before posting a blog review.',
        2,
      ),
      rejected(
        'jack_reviewer',
        'Would love to cover this for my newsletter’s “modern classics” column.',
        4,
        'All copies claimed for this wave—more slots opening next month!',
      ),
    ],
  },
  {
    authorUsername: 'michael_writer',
    title: 'The Inheritance Games',
    coverFile: 'theinheritancegames.jpeg',
    shortDescription:
      'Avery Gram inherits billions from a stranger—but only if she can outthink the Hawthorne family.',
    fullDescription:
      'When Avery Kagan learns she has inherited the Hawthorne fortune, she is thrust into a mansion full of puzzles, traps, and relatives who despise her. Every room hides a clue. Every relative hides a motive. A binge-worthy thriller for readers who love riddles, ensemble casts, and deliciously competitive siblings.',
    ageRating: AgeRating.THIRTEEN_PLUS,
    distributionType: DistributionType.DIGITAL,
    selectionMethod: SelectionMethod.AUTHOR_SELECTS,
    status: BookStatus.ACTIVE,
    totalCopies: 10,
    approvedCount: 4,
    applicationDeadlineDaysFromNow: 16,
    reviewDeadlineDaysFromNow: 42,
    seriesName: 'The Inheritance Games',
    seriesOrder: 1,
    pageCount: 376,
    selectionCriteria: 'Prefer reviewers who enjoy puzzle mysteries and can avoid spoilers.',
    publishedDaysAgo: 12,
    genres: ['Mystery', 'Young Adult', 'Thriller'],
    applications: [
      pending('henry_yaa', 'Puzzle-box mysteries are my comfort genre.'),
      pending('jack_reviewer', 'Would love to compare this to Knives Out structurally.'),
      pending('alice_reader', 'The TikTok hype got me—I want to see if the puzzles hold up.'),
      pending('ivy_bookstagram', 'Already planning a “ clues I spotted ” carousel for this one.'),
      approvedReading('eve_reviews', 'The riddles are so clever—I am taking detailed notes.', 3),
      approvedReading(
        'diana_loves_books',
        'Reading during lunch breaks—the Hawthorne brothers are chaos.',
        4,
      ),
      approvedReviewed(
        'bob_bookworm',
        'YouTube breakdown of every major puzzle and red herring.',
        5,
        linkReview(
          3.5,
          ['https://www.youtube.com/watch?v=FVVPbbmUik4'],
          'The Inheritance Games — Jennifer Lynn Barnes book review (The Fun Size Reader).',
        ),
      ),
      approvedForReview(
        'charlie_reads',
        'Could not put this down over one rainy weekend—review draft almost done.',
        2,
      ),
      rejected(
        'frank_fantasy',
        'Huge puzzle fan here!',
        4,
        'This round prioritized mystery-focused reviewers. Please apply again!',
      ),
      approvedReviewed(
        'grace_mystery',
        'Already posted on Goodreads and BookNest.',
        10,
        textReview(
          4,
          'Jennifer Lynn Barnes understands momentum. The mystery boxes are satisfying, the family dynamics are messy in the best way, and Avery is a grounded anchor in an absurd situation.',
        ),
      ),
    ],
  },
  {
    authorUsername: 'emma_novels',
    title: 'Once Upon a Broken Heart',
    coverFile: 'onceuponabrokenheart.jpeg',
    shortDescription:
      'Evangeline Fox strikes a bargain with the Fatebreaker to stop a wedding—and opens a door to dangerous magic.',
    fullDescription:
      'Evangeline has one chance to stop the boy she loves from marrying her stepsister. Jacks, the Prince of Hearts, offers a deal that seems simple until every clause curdles into consequence. Set in the Caraval universe, this romantasy blends fairy-tale aesthetics with sharp emotional stakes.',
    ageRating: AgeRating.THIRTEEN_PLUS,
    distributionType: DistributionType.DIGITAL,
    selectionMethod: SelectionMethod.LOTTERY,
    status: BookStatus.IN_PROGRESS,
    totalCopies: 5,
    approvedCount: 2,
    applicationDeadlineDaysFromNow: -12,
    reviewDeadlineDaysFromNow: 30,
    lotteryRunDaysAgo: 8,
    seriesName: 'Once Upon a Broken Heart',
    seriesOrder: 1,
    pageCount: 416,
    publishedDaysAgo: 45,
    genres: ['Fantasy', 'Romance', 'Young Adult'],
    applications: [
      approvedReading(
        'diana_loves_books',
        'The atmosphere is gorgeous—I am savoring every chapter.',
        5,
      ),
      approvedForReview(
        'alice_reader',
        'Ready to write about the bargain mechanics and romance payoff.',
        3,
      ),
      rejected(
        'charlie_reads',
        'Romantasy is my favorite genre!',
        8,
        'Lottery selection—thank you for applying!',
      ),
      rejected(
        'ivy_bookstagram',
        'Would create aesthetic content for this cover.',
        8,
        'Lottery selection—thank you for applying!',
      ),
      rejected(
        'henry_yaa',
        'Huge Stephanie Garber fan.',
        8,
        'Lottery selection—thank you for applying!',
      ),
    ],
  },
  {
    authorUsername: 'emma_novels',
    title: 'Two Twisted Crowns',
    coverFile: 'twotwistedcrowns.jpeg',
    shortDescription:
      'On a cursed island, two rivals must share a crown—or lose everything to the monsters in the mist.',
    fullDescription:
      'The second book in the Twisted series escalates the rivalry between Ottilie and Errol into a fight for survival. Crowns, curses, and uneasy alliances collide in a gothic island setting. Readers should come for the banter and stay for the escalating dread.',
    ageRating: AgeRating.SIXTEEN_PLUS,
    distributionType: DistributionType.BOTH,
    selectionMethod: SelectionMethod.AUTHOR_SELECTS,
    status: BookStatus.IN_PROGRESS,
    totalCopies: 4,
    approvedCount: 3,
    applicationDeadlineDaysFromNow: -3,
    reviewDeadlineDaysFromNow: 25,
    seriesName: 'The Twisted Series',
    seriesOrder: 2,
    pageCount: 432,
    publishedDaysAgo: 30,
    genres: ['Fantasy', 'Romance', 'Young Adult'],
    applications: [
      approvedReading('diana_loves_books', 'The banter is elite. Review in progress.', 4),
      approvedReviewed(
        'frank_fantasy',
        'Just finished—working on a spoiler-light discussion review.',
        5,
        textReview(
          4.5,
          'Book two raises the stakes without losing the banter that made book one addictive. The island atmosphere is gothic and gorgeous. Perfect romantasy follow-up.',
        ),
      ),
      approvedReading('eve_reviews', 'Physical copy received! Reading nightly.', 6),
      pending(
        'alice_reader',
        'I read book one and need closure on these crowns.',
      ),
    ],
  },
  {
    authorUsername: 'emma_novels',
    title: 'The Prison Healer',
    coverFile: 'theprisonhealer.jpeg',
    shortDescription:
      'Healer Kiva Meridan must survive a deadly prison trial to save the one person who ever showed her kindness.',
    fullDescription:
      'Kiva has survived ten years in Zalindov prison by keeping her head down and her healing skills sharp. When a new inmate arrives, Kiva is drawn into a trial that forces prisoners to face lethal elemental tests. Dark, high-stakes fantasy for readers who love found family and impossible choices.',
    ageRating: AgeRating.SIXTEEN_PLUS,
    distributionType: DistributionType.DIGITAL,
    selectionMethod: SelectionMethod.AUTHOR_SELECTS,
    status: BookStatus.COMPLETED,
    totalCopies: 5,
    approvedCount: 5,
    applicationDeadlineDaysFromNow: -60,
    reviewDeadlineDaysFromNow: -10,
    pageCount: 491,
    publishedDaysAgo: 120,
    genres: ['Fantasy', 'Young Adult', 'Dystopian'],
    applications: [
      approvedReviewed(
        'henry_yaa',
        'Video review for my teen book club channel.',
        20,
        linkReview(
          4.5,
          ['https://www.youtube.com/watch?v=YWDDiAMrXvY'],
          'The Prison Healer — spoiler-free Lynette Noni book review (Soul of Books).',
        ),
      ),
      approvedReviewed(
        'frank_fantasy',
        'Excellent character work throughout.',
        18,
        textReview(
          4,
          'Strong protagonist, inventive magic system tied to healing, and a finale that earns its emotion. Some middle sections repeat trial beats, but the payoff is worth it.',
        ),
      ),
      approvedReviewed(
        'jack_reviewer',
        'Reviewed on my blog with full trigger warnings.',
        15,
        textReview(
          3,
          'Ambitious and often brutal. Kiva’s arc works, but the trial repetition may exhaust some readers before the emotional payoff lands. Still worth it for dark YA fantasy fans.',
        ),
      ),
      approvedReviewed(
        'charlie_reads',
        'Posted a quick review and a longer thread.',
        12,
        textReview(
          2.5,
          'Gripping premise and a memorable heroine, though the middle trial cycle felt long. I wanted more variation in the tests. Strong ending pulled my rating back up.',
        ),
      ),
      approvedReviewed(
        'bob_bookworm',
        'This book hurt me emotionally and I mean that as praise.',
        10,
        textReview(
          5,
          'The prison setting is claustrophobic and effective. Kiva’s resilience is inspiring without feeling effortless, and the trial structure keeps tension high.',
        ),
      ),
    ],
  },
  {
    authorUsername: 'sarah_author',
    title: 'The Bridge Kingdom',
    coverFile: 'The Bridge Kingdom.jpeg',
    shortDescription:
      'Lara enters a marriage alliance to destroy a kingdom—then discovers the king she was sent to kill might be worth saving.',
    fullDescription:
      'Trained as a weapon, Lara is married off to the Bridge Kingdom’s king as part of a long con. But the court is not what her homeland described, and the king is sharper than anyone warned. Political fantasy romance with espionage, slow trust, and layered betrayals.',
    ageRating: AgeRating.SIXTEEN_PLUS,
    distributionType: DistributionType.PHYSICAL,
    selectionMethod: SelectionMethod.AUTHOR_SELECTS,
    status: BookStatus.ACTIVE,
    totalCopies: 6,
    approvedCount: 2,
    applicationDeadlineDaysFromNow: 20,
    reviewDeadlineDaysFromNow: 55,
    seriesName: 'The Bridge Kingdom',
    seriesOrder: 1,
    pageCount: 354,
    selectionCriteria: 'Physical copies require a verified shipping address in Europe.',
    publishedDaysAgo: 9,
    genres: ['Fantasy', 'Romance'],
    applications: [
      pending('alice_reader', 'I love political fantasy romance and can review within two weeks.'),
      pending('frank_fantasy', 'Based in Bulgaria—easy shipping for me.'),
      approvedReading(
        'diana_loves_books',
        'Copy arrived! Reading with tea and sticky notes.',
        5,
      ),
      approvedReviewed(
        'ivy_bookstagram',
        'Unboxing + first impressions video is live.',
        4,
        linkReview(
          4,
          ['https://www.youtube.com/watch?v=LUjs9eXxvhw'],
          'The Bridge Kingdom — 60-second Danielle L. Jensen book review.',
        ),
      ),
      rejected(
        'bob_bookworm',
        'Would love a physical ARC for my collection.',
        4,
        'Limited international shipping this round.',
      ),
    ],
  },
  {
    authorUsername: 'emma_novels',
    title: 'Only a Monster',
    coverFile: 'onlyamonster.jpeg',
    shortDescription:
      'Joan Hunt discovers her family are monsters—and the boy she likes hunts them.',
    fullDescription:
      'Joan always felt ordinary in her eccentric family. Then she learns they are monsters with dangerous gifts, and Nick, the charming boy from her summer job, belongs to a society sworn to destroy them. Time travel, moral ambiguity, and a romance that complicates every choice.',
    ageRating: AgeRating.THIRTEEN_PLUS,
    distributionType: DistributionType.DIGITAL,
    selectionMethod: SelectionMethod.FIRST_COME,
    status: BookStatus.ACTIVE,
    totalCopies: 8,
    approvedCount: 2,
    applicationDeadlineDaysFromNow: 22,
    reviewDeadlineDaysFromNow: 48,
    pageCount: 392,
    publishedDaysAgo: 6,
    genres: ['Fantasy', 'Young Adult', 'Romance'],
    applications: [
      pending('henry_yaa', 'Time-loop fantasy with romance? Sign me up.'),
      pending('charlie_reads', 'I am ready to read this in one weekend.'),
      approvedReading('diana_loves_books', 'The monster lore is so cool.', 3),
      approvedForReview('eve_reviews', 'Drafting a review about the time travel rules.', 1),
    ],
  },
  {
    authorUsername: 'sarah_author',
    title: 'Heartless Hunter',
    coverFile: 'heartlesshunter.jpeg',
    shortDescription:
      'In a kingdom that executes witches, Rune disguises herself as a bard while Gideon hunts magic in the streets.',
    fullDescription:
      'Rune sings for nobles by night and smuggles witches to safety by day. Gideon is the witch hunter ordered to expose her. Enemies-to-lovers tension meets witch-hunt terror in a historical fantasy with sharp dialogue and escalating danger.',
    ageRating: AgeRating.SIXTEEN_PLUS,
    distributionType: DistributionType.DIGITAL,
    selectionMethod: SelectionMethod.AUTHOR_SELECTS,
    status: BookStatus.ACTIVE,
    totalCopies: 6,
    approvedCount: 1,
    applicationDeadlineDaysFromNow: 19,
    reviewDeadlineDaysFromNow: 44,
    pageCount: 368,
    publishedDaysAgo: 11,
    genres: ['Fantasy', 'Romance', 'Historical Fiction'],
    applications: [
      pending('alice_reader', 'Enemies-to-lovers plus witch drama is my exact vibe.'),
      pending('ivy_bookstagram', 'The cover alone deserves a full photo series.'),
      pending('frank_fantasy', 'I review romantasy weekly on BookNest.'),
      approvedReading(
        'diana_loves_books',
        'Already halfway through and loving the tension.',
        4,
      ),
    ],
  },
  {
    authorUsername: 'emma_novels',
    title: 'Apprentice to the Villain',
    coverFile: 'Apprentice to the Villain.jpeg',
    shortDescription:
      'Evie accepts an apprenticeship with the realm’s most feared villain to save her kingdom—and her heart.',
    fullDescription:
      'After Assist the Villain, Evie returns for a darker bargain. Training under a villain means learning power, politics, and the cost of mercy. Dark academia meets romantasy with mentor tension and found family among misfits.',
    ageRating: AgeRating.SIXTEEN_PLUS,
    distributionType: DistributionType.DIGITAL,
    selectionMethod: SelectionMethod.LOTTERY,
    status: BookStatus.ACTIVE,
    totalCopies: 5,
    approvedCount: 0,
    applicationDeadlineDaysFromNow: -2,
    reviewDeadlineDaysFromNow: 35,
    pageCount: 448,
    publishedDaysAgo: 15,
    genres: ['Fantasy', 'Romance', 'Young Adult'],
    applications: [
      pending('diana_loves_books', 'Need this ARC like air.'),
      pending('alice_reader', 'Book one ended on a cliffhanger—I must know what happens.'),
      pending('frank_fantasy', 'Romantasy reviewer with fast turnaround.'),
      pending('ivy_bookstagram', 'Will create villain-era aesthetic content.'),
      pending('charlie_reads', 'Happy to review within seven days.'),
    ],
  },
  {
    authorUsername: 'sarah_author',
    title: 'Nightbane',
    coverFile: 'Nightbane.jpeg',
    shortDescription:
      'Draft romantasy about a scholar who binds shadows and the prince who should destroy her.',
    fullDescription:
      'Work in progress. Nightbane follows Lyra, a scholar of forbidden shadow magic, and the prince sworn to eradicate her order. This listing is not yet open for applications—it demonstrates draft state in the author dashboard.',
    ageRating: AgeRating.SIXTEEN_PLUS,
    distributionType: DistributionType.DIGITAL,
    selectionMethod: SelectionMethod.AUTHOR_SELECTS,
    status: BookStatus.DRAFT,
    totalCopies: 5,
    approvedCount: 0,
    applicationDeadlineDaysFromNow: 30,
    pageCount: 380,
    genres: ['Fantasy', 'Romance'],
    applications: [],
  },
  {
    authorUsername: 'michael_writer',
    title: 'Killer Instinct',
    coverFile: 'Killer Instinct.jpeg',
    shortDescription:
      'True-crime-obsessed Pip faces a new case when someone she trusts becomes the prime suspect.',
    fullDescription:
      'Sequel energy without needing the first book fresh: Pip is older, sharper, and drawn into a case that hits close to home. The line between observer and participant blurs. For mystery readers who love podcast cadence and ethical tension.',
    ageRating: AgeRating.THIRTEEN_PLUS,
    distributionType: DistributionType.BOTH,
    selectionMethod: SelectionMethod.AUTHOR_SELECTS,
    status: BookStatus.ACTIVE,
    totalCopies: 6,
    approvedCount: 2,
    applicationDeadlineDaysFromNow: 17,
    reviewDeadlineDaysFromNow: 41,
    pageCount: 401,
    publishedDaysAgo: 8,
    genres: ['Mystery', 'Thriller', 'Young Adult'],
    applications: [
      pending('grace_mystery', 'Sequel review coming from a mystery specialist.'),
      pending('jack_reviewer', 'I will compare structure to book one carefully.'),
      approvedReading('eve_reviews', 'Already making my suspect list.', 3),
      approvedReviewed(
        'bob_bookworm',
        'Finished—review focuses on ethics and pacing.',
        4,
        textReview(
          3.5,
          'Killer Instinct doubles down on what worked in the first book while raising the personal stakes for Pip. The ethical dilemmas feel earned, not manufactured, though one subplot felt rushed.',
        ),
      ),
    ],
  },
  {
    authorUsername: 'sarah_author',
    title: 'Anathema',
    coverFile: 'anathema.jpeg',
    shortDescription:
      'A completed dark fantasy about a healer marked by the gods and hunted by the church she once served.',
    fullDescription:
      'Campaign complete. Anathema follows Sister Mira after a divine mark brands her anathema. Former allies hunt her across cathedrals and catacombs. This title showcases a finished book with published reviews and zero remaining copies.',
    ageRating: AgeRating.EIGHTEEN_PLUS,
    distributionType: DistributionType.DIGITAL,
    selectionMethod: SelectionMethod.AUTHOR_SELECTS,
    status: BookStatus.COMPLETED,
    totalCopies: 4,
    approvedCount: 4,
    applicationDeadlineDaysFromNow: -90,
    reviewDeadlineDaysFromNow: -30,
    pageCount: 512,
    publishedDaysAgo: 200,
    genres: ['Fantasy', 'Horror'],
    applications: [
      approvedReviewed(
        'frank_fantasy',
        'Dark fantasy video essay now live.',
        45,
        linkReview(
          5,
          ['https://www.youtube.com/watch?v=6Rbq4AeQRYc'],
          'Anathema — Keri Lake dark romantasy book review (Miss Lindsey Reads).',
        ),
      ),
      approvedReviewed(
        'jack_reviewer',
        'Featured on my newsletter.',
        40,
        textReview(
          3,
          'Ambitious world-building and uncompromising tone. Not for every reader—the grimness may overwhelm—but grim fantasy fans will find a lot to admire.',
        ),
      ),
      approvedReviewed(
        'eve_reviews',
        'Strong finish to the campaign.',
        38,
        textReview(
          4,
          'Excellent prose and atmosphere. The middle pacing slows slightly, but the climax delivers.',
        ),
      ),
      approvedReviewed(
        'alice_reader',
        'One of my favorite ARCs last season.',
        35,
        textReview(
          4.5,
          'Mira is unforgettable. The church politics and body horror elements blend seamlessly.',
        ),
      ),
    ],
  },
  {
    authorUsername: 'emma_novels',
    title: 'The Book of Azrael',
    coverFile: 'The Book of Azrael.jpeg',
    shortDescription:
      'When Lilith is offered to the demon Azrael, she discovers apocalypse is personal.',
    fullDescription:
      'Dark romantasy with gods, demons, and a heroine who refuses to be a sacrifice. Lilith’s bargain with Azrael unlocks a war across realms. For readers who love morally black love interests and high heat fantasy.',
    ageRating: AgeRating.EIGHTEEN_PLUS,
    distributionType: DistributionType.DIGITAL,
    selectionMethod: SelectionMethod.FIRST_COME,
    status: BookStatus.ACTIVE,
    totalCopies: 9,
    approvedCount: 4,
    applicationDeadlineDaysFromNow: 24,
    reviewDeadlineDaysFromNow: 52,
    pageCount: 520,
    publishedDaysAgo: 5,
    genres: ['Fantasy', 'Romance'],
    applications: [
      approvedReviewed(
        'diana_loves_books',
        'Dark romantasy BookTok review is up.',
        5,
        linkReview(
          4.5,
          ['https://www.youtube.com/watch?v=9x65xOBZEyw'],
          'The Book of Azrael — spoiler-free review (Amber V. Nicole).',
        ),
      ),
      approvedReading('ivy_bookstagram', 'Reading and photographing favorite quotes.', 2),
      approvedReading('alice_reader', 'Azrael is a problem and I mean that lovingly.', 4),
      approvedReviewed(
        'frank_fantasy',
        'Review draft ready—focusing on world-building and romance arc.',
        3,
        textReview(
          3.5,
          'Unapologetically dark romantasy—lush prose and high stakes, though the pacing dips in the middle. The target audience will still obsess.',
        ),
      ),
    ],
  },
  {
    authorUsername: 'sarah_author',
    title: 'The Veiled Kingdom',
    coverFile: 'The Veiled Kingdom.jpeg',
    shortDescription:
      'Lottery-listed fantasy about a hidden realm revealed only during the blood moon.',
    fullDescription:
      'Once per generation, the Veiled Kingdom appears for seven nights. Mira enters seeking a cure for her brother and finds a court where every gift demands payment. Lottery selection with digital and physical copies available.',
    ageRating: AgeRating.THIRTEEN_PLUS,
    distributionType: DistributionType.BOTH,
    selectionMethod: SelectionMethod.LOTTERY,
    status: BookStatus.ACTIVE,
    totalCopies: 7,
    approvedCount: 0,
    applicationDeadlineDaysFromNow: 14,
    reviewDeadlineDaysFromNow: 50,
    pageCount: 398,
    publishedDaysAgo: 4,
    genres: ['Fantasy', 'Young Adult'],
    applications: [
      pending('charlie_reads', 'Blood moon fantasy sounds incredible.'),
      pending('henry_yaa', 'I can review quickly after lottery selection.'),
      pending('bob_bookworm', 'Interested in both digital and physical if selected.'),
      pending('grace_mystery', 'Love hidden-world concepts.'),
    ],
  },
  {
    authorUsername: 'michael_writer',
    title: 'The Hunted Heir',
    coverFile: 'The Hunted Heir.jpeg',
    shortDescription:
      'Archived political thriller about an exiled heir hunted across Europe.',
    fullDescription:
      'Campaign archived after a successful run. The Hunted Heir follows Mateo Varga after his family loses power overnight. Now every ally is a suspect. This entry demonstrates archived book state in author analytics.',
    ageRating: AgeRating.SIXTEEN_PLUS,
    distributionType: DistributionType.DIGITAL,
    selectionMethod: SelectionMethod.AUTHOR_SELECTS,
    status: BookStatus.ARCHIVED,
    totalCopies: 3,
    approvedCount: 3,
    applicationDeadlineDaysFromNow: -120,
    reviewDeadlineDaysFromNow: -60,
    pageCount: 342,
    publishedDaysAgo: 300,
    genres: ['Thriller', 'Mystery'],
    applications: [
      approvedReviewed(
        'bob_bookworm',
        'Tight thriller with great European settings.',
        90,
        textReview(
          4,
          'Propulsive and lean. Mateo is a compelling protagonist and the political details feel researched without slowing the plot.',
        ),
      ),
      approvedReviewed(
        'grace_mystery',
        'Video review for my mystery-thriller channel.',
        85,
        linkReview(
          3,
          ['https://www.youtube.com/watch?v=EdeglO-SCWU'],
          'The Hunted Heir — spoiler-free book review (Maive Books).',
        ),
      ),
      approvedReviewed(
        'jack_reviewer',
        'Good showcase for completed thriller campaigns.',
        80,
        textReview(
          2.5,
          'Efficient pacing and clear stakes, though a few chase sequences blur together. Still recommended for Ludlum-style thriller fans.',
        ),
      ),
    ],
  },
  {
    authorUsername: 'sarah_author',
    title: 'The Knight and the Moth',
    coverFile: 'theknightandthemoth.jpeg',
    shortDescription:
      'Physical ARC fantasy about a knight sworn to silence and the spy who steals his secrets.',
    fullDescription:
      'Sir Ren holds a vow of silence in a court rotting from within. Lio arrives as a moth-masked spy with orders to expose the crown. Trust is a luxury neither can afford. Physical copies for European readers.',
    ageRating: AgeRating.THIRTEEN_PLUS,
    distributionType: DistributionType.PHYSICAL,
    selectionMethod: SelectionMethod.AUTHOR_SELECTS,
    status: BookStatus.ACTIVE,
    totalCopies: 4,
    approvedCount: 1,
    applicationDeadlineDaysFromNow: 23,
    reviewDeadlineDaysFromNow: 58,
    pageCount: 336,
    publishedDaysAgo: 13,
    genres: ['Fantasy', 'Historical Fiction'],
    applications: [
      pending('frank_fantasy', 'Sofia-based reader—shipping should be straightforward.'),
      pending('alice_reader', 'Court intrigue plus vow of silence? Yes please.'),
      approvedReading(
        'ivy_bookstagram',
        'Unboxing posted—reading now.',
        3,
      ),
    ],
  },
  {
    authorUsername: 'michael_writer',
    title: 'The Reappearance of Rachel Price',
    coverFile: 'thereappeareanceofrachelprice.jpeg',
    shortDescription:
      'Rachel Price vanished on a true-crime show set—then walked back into camera range.',
    fullDescription:
      'When Rachel Price reappears after two years missing, her daughter Bel thinks the nightmare is over. Instead, Rachel’s story shifts every time she tells it. A twisty thriller about fame, family, and the stories we sell as truth.',
    ageRating: AgeRating.SIXTEEN_PLUS,
    distributionType: DistributionType.DIGITAL,
    selectionMethod: SelectionMethod.AUTHOR_SELECTS,
    status: BookStatus.ACTIVE,
    totalCopies: 7,
    approvedCount: 2,
    applicationDeadlineDaysFromNow: 15,
    reviewDeadlineDaysFromNow: 43,
    pageCount: 388,
    selectionCriteria: 'Prefer reviewers comfortable discussing mental health themes carefully.',
    publishedDaysAgo: 10,
    genres: ['Thriller', 'Mystery', 'Young Adult'],
    applications: [
      pending('grace_mystery', 'True-crime thriller is my wheelhouse.'),
      pending('eve_reviews', 'I will include content notes in my review.'),
      approvedReviewed(
        'jack_reviewer',
        'The unreliable narrative is chef’s kiss.',
        3,
        textReview(
          4.5,
          'Rachel Price is a masterclass in unreliable narrative. Every interview scene shifts your trust, and Bel is a heartbreaking anchor. Stick the landing—and this is one of the year’s best thrillers.',
        ),
      ),
      approvedForReview(
        'bob_bookworm',
        'Almost done—twist hypothesis ready to validate.',
        1,
      ),
      rejected(
        'charlie_reads',
        'Love psychological thrillers!',
        5,
        'Filled this round—please try again for the next title.',
      ),
    ],
  },
];

export const DEMO_FRIENDSHIPS: Array<{
  requesterUsername: string;
  addresseeUsername: string;
  status: FriendStatus;
}> = [
  { requesterUsername: 'alice_reader', addresseeUsername: 'bob_bookworm', status: FriendStatus.ACCEPTED },
  { requesterUsername: 'alice_reader', addresseeUsername: 'charlie_reads', status: FriendStatus.ACCEPTED },
  { requesterUsername: 'bob_bookworm', addresseeUsername: 'charlie_reads', status: FriendStatus.ACCEPTED },
  { requesterUsername: 'diana_loves_books', addresseeUsername: 'alice_reader', status: FriendStatus.ACCEPTED },
  { requesterUsername: 'eve_reviews', addresseeUsername: 'grace_mystery', status: FriendStatus.ACCEPTED },
  { requesterUsername: 'frank_fantasy', addresseeUsername: 'ivy_bookstagram', status: FriendStatus.ACCEPTED },
  { requesterUsername: 'henry_yaa', addresseeUsername: 'jack_reviewer', status: FriendStatus.ACCEPTED },
  { requesterUsername: 'charlie_reads', addresseeUsername: 'diana_loves_books', status: FriendStatus.PENDING },
  { requesterUsername: 'grace_mystery', addresseeUsername: 'henry_yaa', status: FriendStatus.PENDING },
  { requesterUsername: 'ivy_bookstagram', addresseeUsername: 'eve_reviews', status: FriendStatus.PENDING },
];

export const DEMO_AUTHOR_FOLLOWS: Array<{
  followerUsername: string;
  authorUsername: string;
}> = [
  { followerUsername: 'alice_reader', authorUsername: 'sarah_author' },
  { followerUsername: 'alice_reader', authorUsername: 'emma_novels' },
  { followerUsername: 'bob_bookworm', authorUsername: 'michael_writer' },
  { followerUsername: 'charlie_reads', authorUsername: 'sarah_author' },
  { followerUsername: 'charlie_reads', authorUsername: 'michael_writer' },
  { followerUsername: 'diana_loves_books', authorUsername: 'emma_novels' },
  { followerUsername: 'diana_loves_books', authorUsername: 'sarah_author' },
  { followerUsername: 'eve_reviews', authorUsername: 'michael_writer' },
  { followerUsername: 'frank_fantasy', authorUsername: 'sarah_author' },
  { followerUsername: 'grace_mystery', authorUsername: 'michael_writer' },
  { followerUsername: 'henry_yaa', authorUsername: 'emma_novels' },
  { followerUsername: 'ivy_bookstagram', authorUsername: 'emma_novels' },
  { followerUsername: 'ivy_bookstagram', authorUsername: 'sarah_author' },
  { followerUsername: 'jack_reviewer', authorUsername: 'michael_writer' },
  { followerUsername: 'jack_reviewer', authorUsername: 'sarah_author' },
];

export const DEMO_GENRE_PREFERENCES: Array<{
  username: string;
  genres: string[];
  userType: UserType;
}> = [
  { username: 'sarah_author', genres: ['Fantasy', 'Romance', 'Young Adult'], userType: UserType.AUTHOR },
  { username: 'michael_writer', genres: ['Mystery', 'Thriller', 'Young Adult'], userType: UserType.AUTHOR },
  { username: 'emma_novels', genres: ['Romance', 'Fantasy', 'Young Adult'], userType: UserType.AUTHOR },
  { username: 'alice_reader', genres: ['Fantasy', 'Romance', 'Young Adult'], userType: UserType.READER },
  { username: 'bob_bookworm', genres: ['Thriller', 'Mystery', 'Science Fiction'], userType: UserType.READER },
  { username: 'charlie_reads', genres: ['Fantasy', 'Young Adult', 'Contemporary'], userType: UserType.READER },
  { username: 'diana_loves_books', genres: ['Romance', 'Young Adult', 'Fantasy'], userType: UserType.READER },
  { username: 'eve_reviews', genres: ['Mystery', 'Thriller', 'Nonfiction'], userType: UserType.READER },
  { username: 'frank_fantasy', genres: ['Fantasy', 'High Fantasy', 'Historical Fiction'], userType: UserType.READER },
  { username: 'grace_mystery', genres: ['Mystery', 'Thriller', 'Crime'], userType: UserType.READER },
  { username: 'henry_yaa', genres: ['Young Adult', 'Fantasy', 'Contemporary'], userType: UserType.READER },
  { username: 'ivy_bookstagram', genres: ['Romance', 'Fantasy', 'Romantasy'], userType: UserType.READER },
  { username: 'jack_reviewer', genres: ['Nonfiction', 'Historical Fiction', 'Thriller'], userType: UserType.READER },
];

export const DEMO_ACTIVITIES: Array<{
  username: string;
  activityType: ActivityType;
  bookTitle?: string;
}> = [
  { username: 'alice_reader', activityType: ActivityType.BOOK_APPLIED, bookTitle: 'Throne Of Glass' },
  { username: 'bob_bookworm', activityType: ActivityType.BOOK_STARTED, bookTitle: 'Throne Of Glass' },
  { username: 'charlie_reads', activityType: ActivityType.REVIEW_POSTED, bookTitle: 'Throne Of Glass' },
  { username: 'ivy_bookstagram', activityType: ActivityType.REVIEW_POSTED, bookTitle: 'Throne Of Glass' },
  { username: 'bob_bookworm', activityType: ActivityType.REVIEW_POSTED, bookTitle: "A Good Girl's Guide to Murder" },
  { username: 'alice_reader', activityType: ActivityType.REVIEW_POSTED, bookTitle: "A Good Girl's Guide to Murder" },
  { username: 'jack_reviewer', activityType: ActivityType.REVIEW_POSTED, bookTitle: "A Good Girl's Guide to Murder" },
  { username: 'grace_mystery', activityType: ActivityType.REVIEW_POSTED, bookTitle: 'The Inheritance Games' },
  { username: 'bob_bookworm', activityType: ActivityType.REVIEW_POSTED, bookTitle: 'The Inheritance Games' },
  { username: 'charlie_reads', activityType: ActivityType.REVIEW_POSTED, bookTitle: 'Percy Jackson' },
  { username: 'ivy_bookstagram', activityType: ActivityType.REVIEW_POSTED, bookTitle: 'Percy Jackson' },
  { username: 'henry_yaa', activityType: ActivityType.REVIEW_POSTED, bookTitle: 'The Prison Healer' },
  { username: 'frank_fantasy', activityType: ActivityType.BOOK_COMPLETED, bookTitle: 'The Prison Healer' },
  { username: 'frank_fantasy', activityType: ActivityType.REVIEW_POSTED, bookTitle: 'Two Twisted Crowns' },
  { username: 'frank_fantasy', activityType: ActivityType.REVIEW_POSTED, bookTitle: 'Anathema' },
  { username: 'diana_loves_books', activityType: ActivityType.BOOK_APPROVED, bookTitle: 'Once Upon a Broken Heart' },
  { username: 'diana_loves_books', activityType: ActivityType.REVIEW_POSTED, bookTitle: 'The Book of Azrael' },
  { username: 'ivy_bookstagram', activityType: ActivityType.REVIEW_POSTED, bookTitle: 'The Bridge Kingdom' },
  { username: 'jack_reviewer', activityType: ActivityType.REVIEW_POSTED, bookTitle: 'The Reappearance of Rachel Price' },
  { username: 'grace_mystery', activityType: ActivityType.REVIEW_POSTED, bookTitle: 'The Hunted Heir' },
  { username: 'bob_bookworm', activityType: ActivityType.REVIEW_POSTED, bookTitle: 'Killer Instinct' },
  { username: 'grace_mystery', activityType: ActivityType.BOOK_APPLIED, bookTitle: 'Killer Instinct' },
  { username: 'henry_yaa', activityType: ActivityType.BOOK_APPLIED, bookTitle: 'The Hunger Games' },
];

export const EPUB_FILENAME = 'dickens-mystery-of-edwin-drood.epub';
export const COVERS_DIR = 'bookcovers';
