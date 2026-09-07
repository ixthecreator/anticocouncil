import App from "./App";
import { WorkspaceGateway } from "./components/WorkspaceGateway";

export default function WorkspaceEntry() {
  return <WorkspaceGateway>{(props) => <App {...props} />}</WorkspaceGateway>;
}
