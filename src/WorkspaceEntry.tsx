import "./workspace-fonts.css";
import App from "./App";
import { WorkspaceGateway } from "./components/WorkspaceGateway";

export default function WorkspaceEntry({ localOnly = false }: { localOnly?: boolean }) {
  const mode = localOnly ? "local" : "firebase";
  return <WorkspaceGateway key={mode} mode={mode}>{(props) => <App {...props} />}</WorkspaceGateway>;
}
