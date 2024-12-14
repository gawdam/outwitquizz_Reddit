import { Devvit, UseStateResult } from '@devvit/public-api';
import { VotePage } from './components/VotePage.js';
import { ResultsPage } from './components/ResultsPage.js';
import { PageType, PollProps } from './PollModels.js';
import { addPoll } from './components/CreatePoll.js';
import { KeyType, key, userKey, resetRedis, shuffle } from './PollHelpers.js';
import { ConfirmPage } from './components/ConfirmPage.js';

// Devvit.debug.emitSnapshots = true;

Devvit.configure({
  redis: true,
  redditAPI: true,
});

const testApp: Devvit.CustomPostComponent = context => {
  const { useState } = context;
  const [page, setPage] = useState('a');

  let currentPage;
  switch (page) {
    case 'a':
      currentPage = <PageA setPage={setPage} />;
      break;
    case 'b':
      currentPage = <PageB setPage={setPage} />;
      break;
    default:
      currentPage = <PageA setPage={setPage} />;
  }

  return (
    <blocks>
      {currentPage}
    </blocks>
  )
}

const PageA = ({ setPage }: PageProps) => (
  <vstack
    width="100%"
    height="100%"
    alignment="middle center"
    gap="large"
    backgroundColor="lightblue"
  >
    <text size="xxlarge">Page A</text>
    <button onPress={() => setPage('b')}>Go to B</button>
  </vstack>
);

const PageB = ({ setPage }: PageProps) => (
  <vstack
    width="100%"
    height="100%"
    alignment="middle center"
    gap="large"
    backgroundColor="yellow"
  >
    <text size="xxlarge">Page B</text>
    <button onPress={() => setPage('a')}>Go to A</button>
  </vstack>
);


type PageProps = {
  setPage: (page: string) => void;
}



const App: Devvit.CustomPostComponent = (context) => { 
  const { useState, redis, postId, userId } = context;

  // State for tracking the current page
  const [page, navigate] = useState(() => PageType.VOTE);

  // State for tracking votes
  const [votes, setVotes] = useState<number[]>([]);
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [finish, setFinish] = useState(0);
  const [description, setDescription] = useState<string | undefined>();
  const [allowShowResults, setAllowShowResults] = useState(false);
  const [randomizeOrder, setRandomizeOrder] = useState(false);

  const optionsPerPollPage = 4;
  const total = votes.reduce((a, b) => a + b, 0);
  const now = new Date().getTime();
  const remainingMillis = finish - now;

  // Load data once on initialization
  useState(async () => {
    if (!postId) {
      // Load fixture data in development mode
      if (!(await redis.get(key(KeyType.question, `undefined`)))) {
        await resetRedis(context);
      }
    }

    // Fetch poll options
    const fetchedOptions = await redis.zRange(key(KeyType.options, postId), 0, -1);
    const optionList = fetchedOptions.map((option) => option.member);
    setOptions(optionList);

    // Shuffle options if required
    const shuffled = [...optionList];
    shuffle(shuffled);
    setShuffledOptions(shuffled);

    // Fetch votes
    const rsp = await redis.mget(optionList.map((_option, i) => `polls:${postId}:${i}`));
    setVotes(rsp.map((count) => parseInt(count || '0')));

    // Fetch poll finish time
    const finishTime = await redis.get(key(KeyType.finish, postId));
    setFinish(parseInt(finishTime || '0'));

    // Fetch description
    const pollDescription = await redis.get(key(KeyType.description, postId));
    setDescription(pollDescription);

    // Fetch allowShowResults flag
    const allowResults = await redis.get(key(KeyType.allowShowResults, postId));
    setAllowShowResults(allowResults === 'true');

    // Fetch randomizeOrder flag
    const randomize = await redis.get(key(KeyType.randomizeOrder, postId));
    setRandomizeOrder(randomize === 'true');

    // Determine initial page
    const hasVoted = !!(await redis.get(userKey(userId, postId)));
    navigate(hasVoted ? PageType.RESULTS : PageType.VOTE);
  });

  const reset = async (): Promise<void> => {
    await resetRedis(context);
    setVotes([0, 0, 0]); // Default vote reset
    setFinish(new Date().getTime() + 5 * 60 * 1000); // Set new finish time
  };

  const pollPages = Math.ceil(options.length / optionsPerPollPage);

  const props: PollProps = {
    navigate,
    options,
    shuffledOptions,
    optionsPerPollPage,
    pollPages,
    setFinish,
    votes,
    description,
    finish,
    total,
    setVotes,
    remainingMillis,
    allowShowResults,
    randomizeOrder,
    reset,
  };

  // Render logic
  if (!userId) {
    return (
      <hstack grow alignment={'center middle'}>
        <text>Not logged in</text>
      </hstack>
    );
  } else if (page === PageType.VOTE && remainingMillis > 0) {
    return <VotePage {...props} />;
  } else if (page === PageType.CONFIRM && remainingMillis > 0) {
    return <ConfirmPage {...props} />;
  } else {
    return <ResultsPage {...props} />;
  }
};



const App2: Devvit.CustomPostComponent = async (context) => {
  const { useState } = context;

  const redis = context.redis;
  const postId = context.postId;
  const userId = context.userId;

  const [page, navigate] = useState(async () => {
    let hasVoted = false;
    try {
      hasVoted = !!(await redis.get(userKey(userId, postId)));
    } catch {
      //
    }
    return hasVoted ? PageType.RESULTS : PageType.VOTE;
  });

  useState(async () => {
    if (postId) return;

    // Load fixture data in dev mode.
    if (!(await redis.get(key(KeyType.question, `undefined`)))) {
      await resetRedis(context);
    }
  });

  const [currentUserId] = useState(userId);


  const [options] = useState(async () => {
    const options = await redis.zRange(key(KeyType.options, postId), 0, -1);
    return options.map((option) => option.member);
  });
  const rsp = await redis.mget(options.map((_option, i) => `polls:${postId}:${i}`));

  

  const [shuffledOptions] = useState(async () => {
    const array = [...options];
    shuffle(array);
    return array;
  });

  const [votes, setVotes] = useState(async () => {
    const rsp = await redis.mget(options.map((_option, i) => `polls:${postId}:${i}`));
    return rsp.map((count) => parseInt(count || '0'));
  });

  /* Want to know how many skips? ¯\_(ツ)_/¯
  const [skips, setSkips] = useState(async () => {
    return await redis.get(`polls:${postId}:${-2}`);
  });
  console.log(`skips - ${skips}`)
  */

  const reset = async (): Promise<void> => {
    await resetRedis(context);
    setVotes([0, 0, 0]);
    setFinish(new Date().getTime() + 5 * 60 * 1000);
  };

  const total = votes.reduce((a, b) => a + b, 0);

  const now = new Date().getTime();
  const [finish, setFinish] = useState(async () => {
    const finish = await redis.get(key(KeyType.finish, postId));
    return parseInt(finish || '0');
  });
  const remainingMillis = finish - now;

  const [description, _setDescription] = useState(async () => {
    return await redis.get(key(KeyType.description, postId));
  });

  const [allowShowResults, _setAllowShowResults] = useState(async () => {
    const allow = await redis.get(key(KeyType.allowShowResults, postId));
    return allow === 'true';
  });

  const [randomizeOrder, _setRandomizeOrder] = useState(async () => {
    const randomize = await redis.get(key(KeyType.randomizeOrder, postId));
    return randomize === 'true';
  });

  const optionsPerPollPage = 4;
  const pollPages = Math.ceil(options.length / optionsPerPollPage);

  const props: PollProps = {
    navigate,
    options,
    shuffledOptions,
    optionsPerPollPage,
    pollPages,
    setFinish,
    votes,
    description,
    finish,
    total,
    setVotes,
    remainingMillis,
    allowShowResults,
    randomizeOrder,
    reset,
  };

  if (!currentUserId) {
    return (
      <hstack grow alignment={'center middle'}>
        <text>Not logged in</text>
      </hstack>
    );
  } else if (page === PageType.VOTE && remainingMillis > 0) {
    return <VotePage {...props} />;
  } else if (page === PageType.CONFIRM && remainingMillis > 0) {
    return <ConfirmPage {...props} />;
  } else {
    return <ResultsPage {...props} />;
  }
};

Devvit.addMenuItem({
  label: 'Create a new poll',
  location: 'subreddit',
  onPress: (_event, context) => {
    context.ui.showForm(addPoll);
  },
});

Devvit.addCustomPostType({
  name: 'Polls Plus',
  description: 'Polls but better',
  render: App
});



export default Devvit;




const correctAnswer = event.values.correctAnswer.trim();
const incorrectAnswers = event.values.incorrectAnswers
  .split(',')
  .filter((answer: string) => answer.trim() !== '')
  .slice(0, 12);

  const answers = [
    { 
      option: correctAnswer, 
      username: null, // Placeholder for username
      outwitMessage: "Correct answer!", // Placeholder for outwit message
      correct: true // Indicates it's the correct answer
    },
    ...incorrectAnswers.map((answer: string) => ({
      option: answer.trim(),
      username: 'quizmaster', // Placeholder for username
      outwitMessage: 'Outwitted by the quizmaster!', // Placeholder for outwit message
      correct: false // Indicates it's an incorrect answer
    }))
  ];