import { getVotingDependencies } from "../server/firebaseAdmin.js";
import { createVotingHandler } from "../server/votingHttp.js";

export default createVotingHandler(getVotingDependencies, () => process.env.PRIVATE_VOTING_MAINTENANCE === "true");
