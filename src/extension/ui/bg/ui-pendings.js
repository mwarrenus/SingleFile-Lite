/*
 * Copyright 2010-2020 Gildas Lormeau
 * contact : gildas.lormeau <at> gmail.com
 * 
 * This file is part of SingleFile.
 *
 *   The code in this file is free software: you can redistribute it and/or 
 *   modify it under the terms of the GNU Affero General Public License 
 *   (GNU AGPL) as published by the Free Software Foundation, either version 3
 *   of the License, or (at your option) any later version.
 * 
 *   The code in this file is distributed in the hope that it will be useful, 
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of 
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero 
 *   General Public License for more details.
 *
 *   As additional permission under GNU AGPL version 3 section 7, you may 
 *   distribute UNMODIFIED VERSIONS OF THIS file without the copy of the GNU 
 *   AGPL normally required by section 4, provided you include this license 
 *   notice and a URL through which recipients can access the Corresponding 
 *   Source.
 */

/* global browser, window, document, setInterval, location */

import { getMessages } from "./../../core/bg/i18n.js";

const URLLabel = document.getElementById("URLLabel");
const titleLabel = document.getElementById("titleLabel");
const resultsTable = document.getElementById("resultsTable");
const cancelAllButton = document.getElementById("cancelAllButton");
const addUrlsButton = document.getElementById("addUrlsButton");
const addUrlsInput = document.getElementById("addUrlsInput");
const addUrlsCancelButton = document.getElementById("addUrlsCancelButton");
const addUrlsOKButton = document.getElementById("addUrlsOKButton");
const statusText = {};

cancelAllButton.onclick = async () => {
	await browser.runtime.sendMessage({ method: "downloads.cancelAll" });
	await refresh();
};
addUrlsButton.onclick = displayAddUrlsPopup;
if (location.href.endsWith("#side-panel")) {
	document.documentElement.classList.add("side-panel");
}
let URLDisplayed = true;
document.getElementById("URLTitleLabel").onclick = () => {
	URLDisplayed = !URLDisplayed;
	refresh(true);
};
let previousState, noPendingsText;
setInterval(refresh, 1000);
init();

async function init() {
	const messages = await getMessages();
	document.title = messages.pendingsTitle.message;
	cancelAllButton.textContent = messages.pendingsCancelAllButton.message;
	addUrlsButton.textContent = messages.pendingsAddUrlsButton.message;
	addUrlsCancelButton.textContent = messages.pendingsAddUrlsCancelButton.message;
	addUrlsOKButton.textContent = messages.pendingsAddUrlsOKButton.message;
	document.getElementById("addUrlsLabel").textContent = messages.pendingsAddUrls.message;
	URLLabel.textContent = messages.pendingsURLTitle.message;
	titleLabel.textContent = messages.pendingsTitleTitle.message;
	document.getElementById("statusLabel").textContent = messages.pendingsStatusTitle.message;
	statusText.pending = messages.pendingsPendingStatus.message;
	statusText.processing = messages.pendingsProcessingStatus.message;
	statusText.cancelling = messages.pendingsCancellingStatus.message;
	noPendingsText = messages.pendingsNoPendings.message;
	refresh();
}

function resetTable() {
	resultsTable.innerHTML = "";
}

function updateTable(results) {
	if (results.length) {
		results.sort((taskInfo1, taskInfo2) => taskInfo1.index - taskInfo2.index);
		results.forEach((taskInfo) => {
			const row = document.createElement("div");
			const cellURL = document.createElement("span");
			const cellStatus = document.createElement("span");
			const cellCancel = document.createElement("span");
			const buttonCancel = document.createElement("button");
			row.className = "result-row";
			if (URLDisplayed) {
				cellURL.textContent = taskInfo.url;
			} else {
				cellURL.textContent = taskInfo.title;
			}
			cellURL.className = "result-url-title";
			cellURL.onclick = () => selectTab(taskInfo.tabId);
			if (taskInfo.cancelled) {
				cellStatus.textContent = statusText.cancelling;
			} else {
				cellStatus.textContent = statusText[taskInfo.status];
				buttonCancel.textContent = "×";
				buttonCancel.onclick = () => cancel(taskInfo.id);
				cellCancel.appendChild(buttonCancel);
			}
			cellStatus.className = "result-status";
			cellCancel.className = "result-cancel";
			row.appendChild(cellURL);
			row.appendChild(cellStatus);
			row.appendChild(cellCancel);
			resultsTable.appendChild(row);
		});
	}
}

async function cancel(taskId) {
	await browser.runtime.sendMessage({ method: "downloads.cancel", taskId });
	await refresh();
}

async function selectTab(tabId) {
	await browser.runtime.sendMessage({ method: "tabs.activate", tabId });
	await refresh();
}

async function displayAddUrlsPopup() {
	document.getElementById("formAddUrls").style.setProperty("display", "flex");
	document.querySelector("#formAddUrls .popup-content").style.setProperty("align-self", "center");
	addUrlsInput.value = "";
	addUrlsInput.focus();
	document.body.style.setProperty("overflow-y", "hidden");
	const urls = await new Promise(resolve => {
		addUrlsOKButton.onclick = event => hideAndResolve(event, addUrlsInput.value);
		addUrlsCancelButton.onclick = event => hideAndResolve(event);
		window.onkeyup = event => {
			if (event.key == "Escape") {
				hideAndResolve(event);
			}
		};

		function hideAndResolve(event, value = "") {
			event.preventDefault();
			document.getElementById("formAddUrls").style.setProperty("display", "none");
			document.body.style.setProperty("overflow-y", "");
			resolve(value.split("\n").map(url => url.trim()).filter(url => url));
		}
	});
	if (urls.length) {
		await browser.runtime.sendMessage({ method: "downloads.saveUrls", urls });
	}
}

async function refresh(force) {
	const results = await browser.runtime.sendMessage({ method: "downloads.getInfo" });
	const currentState = JSON.stringify(results);
	if (previousState != currentState || force) {
		previousState = currentState;
		resetTable();
		if (URLDisplayed) {
			URLLabel.className = "";
			titleLabel.className = "unselected";
		} else {
			URLLabel.className = "unselected";
			titleLabel.className = "";
		}
		updateTable(results);
		if (!results.length) {
			const row = document.createElement("div");
			row.className = "result-row";
			const cell = document.createElement("span");
			cell.colSpan = 3;
			cell.className = "no-result";
			cell.textContent = noPendingsText;
			row.appendChild(cell);
			resultsTable.appendChild(row);
		}
	}
}