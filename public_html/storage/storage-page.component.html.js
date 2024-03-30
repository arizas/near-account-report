export default /*html*/ `<div class="card">
    <div class="card-header">Store data on a git server</div>
    <div class="card-body">
        <p>You may store a remote copy of your data in a git server, which you can then use to synchronize with other browsers and devices</p>

        <p>Enter wasm-git access key</p>
        <p>
            <span id="currentuserspan"></span>
            <input id="wasmgitaccesskey" type="password" />
        </p>
        <p>
        <label for="remoterepo" class="form-label">URL to git repository</label>
        <input type="text" class="form-control" id="remoterepo" placeholder="https://wasm-git.petersalomonsen.com/YOUR_ACCOUNT-nearsight">
        </p>
        <button class="btn btn-primary" id="syncbutton">Synchronize</button>
        <button class="btn btn-primary" id="deletelocaldatabutton">Delete local data</button>
    </div>
    <div class="card-header">Fetch exchange rates</div>
    <div class="card-body">
        <p>Fetch exchange rates from various sources and store in your git repository</p>
        <button class="btn btn-primary" id="fetchnearusdbutton">Fetch NEAR/USD rates from nearblocks.io</button>
        <button class="btn btn-primary" id="fetchusdnokbutton">Fetch USD/NOK rates from Norges Bank</button>
    </div>
</div>`;
