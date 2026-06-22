import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["*://sports.active.com/*"],
  run_at: "document_idle"
}


console.log("content script loaded")

function addButton() {
  const target = document.querySelector("#athleteFilerArea > div")

  if (!target || document.querySelector("#myInjectedBtn")) return

  const btn = document.createElement("button")
  btn.id = "myInjectedBtn"
  btn.textContent = "YOOOOOOOOO"
  btn.style.cssText = `
    position: relative;
    background: red;
    color: white;
    padding: 8px;
    margin: 5px;
  `

  target.appendChild(btn)

  console.log("button injected")
}

const observer = new MutationObserver(() => {
  addButton()
})

observer.observe(document.body, {
  childList: true,
  subtree: true
})

addButton()