import { getVotingDependencies } from "../server/firebaseAdmin";
import { createVotingHandler } from "../server/votingHttp";

export default createVotingHandler(getVotingDependencies, () => process.env.PRIVATE_VOTING_MAINTENANCE === "true");
