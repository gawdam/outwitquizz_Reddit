import { Devvit } from "@devvit/public-api";

export enum PageType {
  VOTE,
  RESULTS,
  CONFIRM,
}

type OptionDetail = {
  option: string;
  username: string | null;
  snoovatarURL: string;
  outwitMessage: string;
  correct: boolean;
  won: number;
  played:number;
};

export type PollProps = {
  navigate: (page: PageType) => void;
  remainingMillis: number;
  options: string[];
  shuffledOptions: string[];
  optionsPerPollPage: number;
  pollPages: number;
  votes: number[];
  description: string | undefined;
  setVotes: (votes: number[]) => void;
  setFinish: (timestamp: number) => void;
  finish: number;
  total: number;
  allowShowResults: boolean;
  randomizeOrder: boolean;
  reset: () => Promise<void>;

  //12th Dec 2024 - Gowdham - ability for user to add option
  addOptionHandler: ()=>void;
  addedOption : string;
  showOutwittedToast: (username: string,outwitMessage:string)=>void;
  optionDetails: OptionDetail[],
  updateOptionDetails:(postId: string, votedOption: string)=>void;
};
