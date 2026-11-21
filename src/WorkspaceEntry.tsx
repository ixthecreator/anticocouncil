import App from "./App";
import { WorkspaceGateway } from "./components/WorkspaceGateway";
import { WorkbenchWindow } from "./components/Workbench";

export default function WorkspaceEntry({ localOnly = false }: { localOnly?: boolean }) {
  const mode = localOnly ? "local" : "firebase";
  const standalone = new URLSearchParams(window.location.search).get("workbench") === "1";
  return <WorkspaceGateway key={mode} mode={mode}>{(props) => standalone
    ? <WorkbenchWindow draftScope={props.draftScope} account={props.account} />
    : <App {...props} />}</WorkspaceGateway>;
}
