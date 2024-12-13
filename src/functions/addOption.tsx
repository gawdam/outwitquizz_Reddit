import { Devvit, ZMember } from '@devvit/public-api';
import { key, KeyType } from '../PollHelpers.js'; 

export const addOptionForm2 = Devvit.createForm(
    {
      title: 'Add a poll',
      acceptLabel: 'Post',
      fields: [
        {
          name: 'userOption',
          label: 'Your answer',
          type: 'string',
          required: true,
          helpText: `E.g. What is your favorite color?`,
        },
        // Description will be used as post selftext, once that is supported for custom posts
        // {
        //   name: `description`,
        //   label: `Description (Optional)`,
        //   type: `string`,
        // },
        {
          name: 'userMessage',
          label: 'Your message to redditors who take the bait',
          type: 'paragraph',
          required: true,
          helpText: `seems like you opened a can of whoop ass!`,
        },
        
      ],
    },
    async (event, { reddit, subredditId, ui, redis }) => {
      const sub = await reddit.getSubredditById(subredditId);
  

  
      ui.showToast(event.values.userMessage);
    }
  );
  