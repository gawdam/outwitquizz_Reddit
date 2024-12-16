import { Devvit, useState } from '@devvit/public-api';
import { PageType, PollProps } from '../PollModels.js';
import { formatCount } from '../PollHelpers.js';
import moment from 'moment';


type OptionDetail = {
  option: string;
  username: string | null;
  snoovatarURL: string;
  outwitMessage: string;
  correct: boolean;
  won: number;
  played:number
};

type ResultProps = {
  option: string;
  votes: number;
  total: number;
  winner: boolean;
  optionDetail: OptionDetail;
};


const PollResult = ({ option, votes, total, winner, optionDetail }: ResultProps): JSX.Element => {
  const percent = Math.max((optionDetail.won / total) * 100, 0.5);
  const voteCount = formatCount(optionDetail.won);
  const [showUsername, setShowUsername] = useState(false);
  const percentFormatted = percent.toFixed(1);

  const getBarColor = () => {
    if (optionDetail.correct && winner) return 'green';
    if (optionDetail.correct && !winner) return 'rgba(0, 255, 0, 0.3)'; // faded green
    return winner ? 'upvote-foreground-enabled' : 'upvote-background-disabled';
  };

  const PercentBar = (): JSX.Element | false =>
    percent >= 0 && (
      <hstack
        cornerRadius="small"
        backgroundColor={getBarColor()}
        width={percent}
        height={'100%'}
        alignment={'center middle'}
      >
        <vstack>
          <spacer shape="square" size="small" />
        </vstack>
      </hstack>
    );

  if (!option && !votes) {
    return (
      <vstack>
        <text color={'transparent'}>_</text>
        <hstack border={'thin'} borderColor={'transparent'}>
          <text color={'transparent'}>_</text>
        </hstack>
      </vstack>
    );
  }
  const toggleUsername = () => {
    setShowUsername(!showUsername);
  };
  const TickOrUsername = (): JSX.Element => (
    <hstack width="60px" height="60px" alignment="center middle">
      {optionDetail.correct ? (
        <text size="xlarge" color="green">✓</text>
      ) : (
        <text size="small" color="secondary">{optionDetail.username || 'User'}</text>
      )}
    </hstack>
  );
  return (
    <hstack width={'100%'} alignment="middle">
      {/* <icon name="approve-fill"></icon> */}
      <zstack width="50px" height="40px" alignment="center middle" onPress={toggleUsername}>
      {!showUsername && (optionDetail.correct ? (
        <icon name="checkbox-fill" color="green"  size="large"  />
      ):
      (<image
          
          url={optionDetail.snoovatarURL||'https://i.redd.it/snoovatar/avatars/f6c73a37-3632-4ef8-aed7-c5f53402385d.png'}
          imageWidth={40}
          imageHeight={40}
          resizeMode="fit"
          description={`Snoovatar of ${optionDetail.username || 'user'}`}
        />))
      }
       {showUsername && (
              <text size="xsmall" color="secondary">{ optionDetail.correct? 'Correct answer': optionDetail.username=='Quizmaster'?'Quizmaster' : `u/${optionDetail.username}` }</text>
            )}
      
      </zstack>
      <zstack grow>
        <PercentBar />
        <hstack padding="small" width="100%" alignment="middle">
        <text weight="bold">{voteCount}</text>
          <spacer size="medium" />
          <text grow>{option}</text>
        </hstack>
      </zstack>
    </hstack>
  );
};



export const ResultsPage: Devvit.BlockComponent<PollProps> =  (
  {
    reset,
    finish,
    setFinish,
    options,
    optionsPerPollPage,
    pollPages,
    votes,
    total,
    remainingMillis,
    navigate,
    addOptionHandler,
    optionDetails
  },
  { postId, useState }
) => {
  const remaining = moment.duration(remainingMillis).humanize();
  const max = Math.max(...votes);

  const zipped = options.map((option, index) => {
    const matchingOptionDetail = optionDetails.find(detail => detail.option === option);
    return {
      option,
      votes: matchingOptionDetail!.won,
      total,
      winner: votes[index] === max,
      optionDetail: matchingOptionDetail!// Fallback to an empty object if no match is found
    };
  });
  zipped.sort((a, b) => b.votes - a.votes);
  const three = 3 * 60 * 1000;

  const [pollPage, setPollPage] = useState(1);
  const rangeStart = (pollPage - 1) * optionsPerPollPage;
  const rangeEnd = pollPage * optionsPerPollPage;

  const prevPollPage: Devvit.Blocks.OnPressEventHandler = async () => {
    if (pollPage > 1) {
      setPollPage(pollPage - 1);
    }
  };
  const nextPollPage: Devvit.Blocks.OnPressEventHandler = async () => {
    if (pollPage < pollPages) {
      setPollPage(pollPage + 1);
    }
  };

  return (
    <vstack width="100%" height="100%" padding="medium" gap="none" grow>
      {remainingMillis > 0 && (
        <hstack height="10%" width="100%" alignment="middle">
          <text style="heading" color="green">
            Open
          </text>
          <text style="body">&nbsp;· {remaining} left</text>
        </hstack>
      )}
      {remainingMillis <= 0 && (
        <hstack height="10%" width="100%" alignment="middle">
          <text style="heading">Closed</text>
          <text style="body">&nbsp;· {formatCount(total)} votes</text>
        </hstack>
      )}
      <spacer size="xsmall" />
      <hstack border="thin"></hstack>

      <vstack gap="small">
        <spacer size="xsmall" />
        {zipped.slice(rangeStart, rangeEnd).map((props) => {
          return <PollResult {...props} />;
        })}
      </vstack>
      <spacer />
      <hstack width="100%" height="15%" alignment="middle">
        {pollPages > 1 && (
          <hstack grow gap="medium" alignment="middle">
            <button
              size="small"
              icon="back-outline"
              onPress={prevPollPage}
              disabled={pollPage === 1}
            />
            <text>
              Page {pollPage} of {pollPages}
            </text>
            <button
              size="small"
              icon="forward-outline"
              onPress={nextPollPage}
              disabled={pollPage === pollPages}
            />
          </hstack>
        )}
        <hstack width="100%" height="100%" alignment="middle">
      <spacer />
      <button
          size="medium"
          appearance="primary"
          onPress={addOptionHandler}
        >
          Add your own answer
        </button>
        </hstack>
      </hstack>

      
    </vstack>
  );
};
