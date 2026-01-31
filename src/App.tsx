import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main
      className="flex flex-col items-center justify-center flex-1 bg-base-100 text-base-content p-4"
      data-theme="zinc"
    >
      <div className="flex flex-row space-x-8 mb-8">
        <a href="https://tauri.app" target="_blank">
          <img
            src="/tauri.svg"
            className="w-24 h-24 hover:drop-shadow-[0_0_2em_#24c8db] transition-all"
            alt="Tauri logo"
          />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img
            src={reactLogo}
            className="w-24 h-24 hover:drop-shadow-[0_0_2em_#61dafb] transition-all"
            alt="React logo"
          />
        </a>
      </div>

      <h1 className="text-4xl font-bold mb-8 text-primary flex items-center gap-2">
        <span>🦊</span> gitlabify
      </h1>

      <p className="mb-8 opacity-70">GitLab Desktop Notification Center</p>

      <form
        className="flex space-x-4 mb-8"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          className="input input-bordered w-full max-w-xs"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button className="btn btn-primary" type="submit">
          Greet
        </button>
      </form>

      <p className="text-xl font-medium">{greetMsg}</p>
    </main>
  );
}

export default App;
