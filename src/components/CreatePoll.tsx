import { Devvit, ZMember } from '@devvit/public-api';
import { key, KeyType } from '../PollHelpers.js';

export const addPoll = Devvit.createForm(
  {
    title: 'Create a quiz',
    acceptLabel: 'Post',
    fields: [
      {
        name: 'question',
        label: 'Question',
        type: 'string',
        required: true,
        helpText: `E.g. What is the meaning of Crapulence?`,
      },
      // Description will be used as post selftext, once that is supported for custom posts
      // {
      //   name: `description`,
      //   label: `Description (Optional)`,
      //   type: `string`,
      // },
      {
        name: 'correctAnswer',
        label: 'The correct answer to the question',
        type: 'paragraph',
        required: true,
        helpText: `E.g. "Sickness caused by excessive drinking or eating."`,
      },
      {
        name: 'incorrectAnswers',
        label: 'Other options (up to 3 total, use a comma to separate)',
        type: 'paragraph',
        required: true,
        helpText: `E.g. "The act of shitting while farting"`,
      },
      {
        name: 'days',
        label: 'Days to allow voting',
        type: 'string',
        defaultValue: `2`,
        required: true,
      },
      {
        name: 'randomizeOrder',
        label: 'Shuffle order of poll options',
        type: 'boolean',
        defaultValue: true,
        helpText: `To reduce bias, options will be presented to the user in a shuffled order.`,
      },
      {
        name: 'allowShowResults',
        label: 'Include "Show Results" option',
        type: 'boolean',
        defaultValue: true,
        helpText: `This allow users to see poll results without voting. Users cannot vote after viewing the results.`,
      },
    ],
  },
  async (event, { reddit, subredditId, ui, redis }) => {
    const sub = await reddit.getSubredditById(subredditId);
    const answers: ZMember[] = [
      { member: event.values.correctAnswer.trim(), score: 0 }, // Add correct answer with top priority
      ...event.values.incorrectAnswers
        .split(',') // Split into an array
        .filter((answer: string) => answer.trim() !== '') // Remove empty strings
        .slice(0, 12) // Only include the first 12 answers
        .map((answer: string, i: number) => ({ member: answer.trim(), score: 0 })) // Adjust scores
    ];
    
    if (answers.length < 2) {
      ui.showToast({
        text: 'Post Failed - You must include at least one correct and one incorrect options.',
        appearance: 'neutral',
      });
      return;
    }
    
    

    const options = {
      subredditName: sub.name,
      title: event.values.question,
      // text: "TODO - description/selftext",
      preview: (
        <hstack alignment={'center middle'}>
          <text>Loading...</text>
        </hstack>
      ),
    };
    const post = await reddit.submitPost(options);

    const timestamp = new Date().getTime() + parseInt(event.values.days) * 24 * 60 * 60 * 1000;
    const allowShowResults = event.values.allowShowResults ? 'true' : 'false';
    const randomizeOrder = event.values.randomizeOrder ? 'true' : 'false';

    const optionDetails = [
  {
    option: event.values.correctAnswer,
    username: null,
    outwitMessage: "This is the correct answer!",
    correct: true,
  },
  ...event.values.incorrectAnswers
    .split(',')
    .map((answer: string) => answer.trim()) // Remove whitespace
    .filter((answer: string) => answer !== '') // Exclude empty strings
    .map((answer: string) => ({
      option: answer,
      username: "Quizmaster",
      outwitMessage: "This is a tricky one.",
      correct: false,
    })),
];

    
    // Serialize the answers array to a JSON string
    const optionDetailsJSON = JSON.stringify(optionDetails);
    
    // Store the JSON string in Redis
    await redis.set(key(KeyType.optionDetails, post.id), optionDetailsJSON);

    await redis.set(key(KeyType.finish, post.id), timestamp + '');
    await redis.set(key(KeyType.question, post.id), event.values.question);
    await redis.set(key(KeyType.description, post.id), event.values.description);
    await redis.zAdd(key(KeyType.options, post.id), ...answers);
    await redis.set(key(KeyType.allowShowResults, post.id), allowShowResults);
    await redis.set(key(KeyType.randomizeOrder, post.id), randomizeOrder);

    console.log(optionDetailsJSON);
    ui.showToast('Poll created!');
  }
);
