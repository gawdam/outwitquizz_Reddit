import { Devvit, useForm } from '@devvit/public-api';
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

const App: Devvit.CustomPostComponent =  (context) => {
  const useState = context.useState;
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

  const [options,setOptions] = useState(async () => {
    const options = await redis.zRange(key(KeyType.options, postId), 0, -1);
    return options.map((option) => option.member);
  });

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

  // 12th Dec 2024 - Gowdham - add option and addedOption

  const addedOption = "dummy"

const addOptionForm = useForm(
  {
    fields: [
      {
        name: 'userOption',
        label: 'Your option',
        type: 'string',
        required: true,
        helpText: `You get 1 vote for every user that selects your option`,
      },
      // Description will be used as post selftext, once that is supported for custom posts
      // {
      //   name: `description`,
      //   label: `Description (Optional)`,
      //   type: `string`,
      // },
      {
        name: 'userMessage',
        label: 'Your message (displays to users who vote your option)',
        type: 'paragraph',
        helpText: `Seems like you opened a can of whoop ass!`,
      },
      
    ],
  },
  async (values) => {
    console.log(values);
    const newOption = values.userOption;
    const newMessage = values.userMessage;
    if (newOption == null) return;

    try {
      const currentUser = await context.reddit.getCurrentUser();
      const username = currentUser?.username;

      if (username) {
        await updateOption(newOption, newMessage, username);
      } else {
        console.error('Unable to retrieve username');
        context.ui.showToast('Unable to add option: Could not retrieve username');
      }
    } catch (error) {
      console.error('Error getting current user:', error);
      context.ui.showToast('An error occurred while adding your option');
    }
  }
);

// In your component or event handler where you want to show the form
const addOptionHandler = async () => {
  await context.ui.showForm(addOptionForm);
};
  


const addNewOption = async (newOption: string) => {
  setOptions((prevOptions) => {
    const updatedOptions = [...prevOptions, newOption];
    setVotes((prevVotes) => {
      const updatedVotes = [...prevVotes, 0];
      // Update Redis here
      redis.set(`polls:${postId}:${updatedOptions.length - 1}`, '0');
      return updatedVotes;
    });
    return updatedOptions;
  });
};

const updateOption = async (newOption: string, newMessage: string|undefined, username: string) => {
  console.log('Button pressed!');
  if (!newOption || newOption.trim() === '') {
    console.error('Option cannot be empty');
    return;
  }

  if (options.includes(newOption)) {
    console.error('Option already exists');
    return;
  }

  try {
    // Add the new option to the options list
    await addNewOption(newOption);


    const newOptionDetails = {
      option: newOption,
      username: username,
      outwitMessage: newMessage,
      correct: false,
    };

    // Retrieve existing option details from Redis
    const existingOptionDetailsJSON = await redis.get(key(KeyType.optionDetails, postId));
    const existingOptionDetails = existingOptionDetailsJSON
      ? JSON.parse(existingOptionDetailsJSON)
      : [];

    // Append the new option details to the array
    const updatedOptionDetails = [...existingOptionDetails, newOptionDetails];

    // Save updated option details to Redis
    const updatedOptionDetailsJSON = JSON.stringify(updatedOptionDetails);
    await redis.set(key(KeyType.optionDetails, postId), updatedOptionDetailsJSON);

    // Add the new option to the poll options in Redis
    await redis.zAdd(key(KeyType.options, postId), { member: newOption, score: 0 });

    console.log(`Option "${newOption}" added successfully!`);
  } catch (error) {
    console.error('Failed to add the option:', error);
  }
};

const addComment = async (outwitterUsername: string, outwitterUserMessage: string) => {
  try {
    
    // Get the current user
    const currentUser = await context.reddit.getCurrentUser();
    const username = currentUser?.username;

    if (username) {
      // Get the current post
      const post = await context.reddit.getPostById(postId!);

      // Add a comment to the post
      await post.addComment({
        text: `${username} has been outwitted by u/${outwitterUsername}! \nu/${outwitterUsername}- "${outwitterUserMessage}"`,
      });

      console.log(`Comment added for user ${username}`);
    } else {
      console.error('Unable to retrieve username');
    }
  } catch (error) {
    console.error('Error adding comment:', error);
  }
}

const showOutwittedToast = async (username: string, userMessage: string) => {

  
  if(username==null){
    await context.ui.showToast({
      text: `Correct answer!`,
      // appearance: 'neutral',
      // duration: 5000 // Show for 5 seconds
    });
  }
  else{await context.ui.showToast({
    text: `You've been outwitted by u/${username}! \nu/${username}- "${userMessage}"`,
    // appearance: 'neutral',
    // duration: 5000 // Show for 5 seconds
  });}
  await addComment(username,userMessage);

};
const showOutwittedDialog = (context: Devvit.Context, username: string, userMessage: string) => {
  const outwitForm = Devvit.createForm(
    {
      fields: [
        {
          name: 'message',
          label:'',
          type: 'string',
          defaultValue: `You've been outwitted by ${username}! ${userMessage}`,
          disabled: true,
        },
      ],
      title: 'Outwitted!',
      acceptLabel: 'OK',
    },
    () => {
      // This function is called when the user clicks the OK button
      // You can add any additional logic here if needed
    }
  );

  context.ui.showForm(outwitForm);
};


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
    addOptionHandler,
    addedOption ,
    showOutwittedToast
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
  label: 'Create a new outwitquizz',
  location: 'subreddit',
  onPress: (_event, context) => {
    context.ui.showForm(addPoll);
  },
});

Devvit.addCustomPostType({
  name: 'Polls Plus',
  description: 'Polls but better',
  render: App,
});

export default Devvit;
