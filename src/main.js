import { Keypair, Horizon, TransactionBuilder, Operation, Asset } from '@stellar/stellar-sdk';

Pi.init({ version: '2.0' });

let currentUser = null;
let walletKeypair = null;
let walletPublicKey = null;

const authScreen = document.getElementById('auth-screen');
const warningScreen = document.getElementById('warning-screen');
const walletImportScreen = document.getElementById('wallet-import-screen');
const mainScreen = document.getElementById('main-screen');
const authBtn = document.getElementById('auth-btn');
const authError = document.getElementById('auth-error');
const understandInput = document.getElementById('understand-input');
const warningContinueBtn = document.getElementById('warning-continue-btn');
const warningError = document.getElementById('warning-error');
const walletMnemonic = document.getElementById('wallet-mnemonic');
const wordCount = document.getElementById('word-count');
const importContinueBtn = document.getElementById('import-continue-btn');
const importError = document.getElementById('import-error');
const logoutBtn = document.getElementById('logout-btn');
const welcomeMsg = document.getElementById('welcome-msg');
const walletAddr = document.getElementById('wallet-address');
const userName = document.getElementById('user-name');
const HORIZON_URL = 'https://api.mainnet.minepi.com';
const NETWORK_PASSPHRASE = 'Pi Network';

// ─── Pi SDK Auth ───
authBtn.addEventListener('click', async () => {
  authError.classList.add('hidden');
  authBtn.disabled = true;
  authBtn.textContent = 'Connecting…';

  try {
    const auth = await Pi.authenticate(
      ['username', 'wallet_address', 'payments'],
      onIncompletePayment
    );
    currentUser = auth.user;
    localStorage.setItem('rescuepi-user', JSON.stringify(auth));
    authScreen.classList.add('hidden');
    warningScreen.classList.remove('hidden');
  } catch (err) {
    authError.textContent = err.message || 'Authentication failed';
    authError.classList.remove('hidden');
  } finally {
    authBtn.disabled = false;
    authBtn.textContent = 'Sign in with Pi';
  }
});

function onIncompletePayment(payment) {
  console.warn('Incomplete payment found:', payment);
}

// ─── Warning → "I understand" ───
understandInput.addEventListener('input', () => {
  warningContinueBtn.disabled = !/^i understand$/i.test(understandInput.value.trim());
});

warningContinueBtn.addEventListener('click', () => {
  warningScreen.classList.add('hidden');
  walletImportScreen.classList.remove('hidden');
  understandInput.value = '';
  warningContinueBtn.disabled = true;
});

// ─── Word counter ───
walletMnemonic.addEventListener('input', () => {
  const val = walletMnemonic.value.trim();
  const words = val ? val.split(/\s+/) : [];
  wordCount.textContent = `${words.length} / 24`;
  wordCount.style.color = words.length === 24 ? 'var(--success)' : 'var(--text-muted)';
});

// ─── Wallet Import ───
importContinueBtn.addEventListener('click', async () => {
  importError.classList.add('hidden');
  importContinueBtn.disabled = true;
  importContinueBtn.textContent = 'Connecting wallet…';

  const mnemonic = walletMnemonic.value.trim();
  const words = mnemonic.split(/\s+/);

  if (words.length !== 24) {
    importError.textContent = `Expected 24 words, got ${words.length}`;
    importError.classList.remove('hidden');
    importContinueBtn.disabled = false;
    importContinueBtn.textContent = 'Connect Wallet';
    return;
  }

  try {
    const { mnemonicToSeedSync } = await import('@scure/bip39');
    const { derivePath } = await import('ed25519-hd-key');
    const { bytesToHex } = await import('@noble/hashes/utils.js');
    const seed = mnemonicToSeedSync(mnemonic);
    const derived = derivePath("m/44'/314159'/0'", bytesToHex(seed));
    walletKeypair = Keypair.fromRawEd25519Seed(derived.key);
    walletPublicKey = walletKeypair.publicKey();

    walletImportScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    showMainScreen();
  } catch (err) {
    console.error('Import error:', err);
    importError.textContent = err.message || 'Invalid mnemonic. Check your phrase and try again.';
    importError.classList.remove('hidden');
    importContinueBtn.disabled = false;
    importContinueBtn.textContent = 'Connect Wallet';
  }
});

function showMainScreen() {
  welcomeMsg.textContent = `Hello, ${currentUser.username || 'Pioneer'}`;
  walletAddr.textContent = `Wallet: ${walletPublicKey}`;
  if (currentUser.username) {
    userName.textContent = `@${currentUser.username}`;
  }
  renderDestinations();
  loadSchedules();
  rescueActivateBtn.classList.remove('hidden');
  rescueDeactivateBtn.classList.add('hidden');
  rescueStatus.classList.add('hidden');
  rescueError.classList.add('hidden');
  if (rescueTimer) {
    clearInterval(rescueTimer);
    rescueTimer = null;
  }
  rescueActive = false;
  accountDetailsDiv.classList.add('hidden');
  accountDetailsBtn.disabled = false;
  accountDetailsBtn.textContent = 'Load Account Details';
  createAccountResult.classList.add('hidden');
  createAccountBtn.disabled = false;
  createAccountBtn.textContent = 'Create Account';
}

// ─── Logout ───
logoutBtn.addEventListener('click', () => {
  deactivateRescue();
  currentUser = null;
  walletKeypair = null;
  walletPublicKey = null;
  localStorage.removeItem('rescuepi-user');
  walletMnemonic.value = '';
  wordCount.textContent = '0 / 24';
  wordCount.style.color = '';
  mainScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
});

function shortenAddr(addr) {
  if (!addr || addr.length < 12) return addr;
  return addr.slice(0, 5) + '...' + addr.slice(-5);
}

// ─── Rescue Mode ───
const RESCUE_DESTINATIONS = [
  'GDJMJNEUV42VOKW6UQ42CDK3J5IBHEFERY4J62XURALGUC4YNUI2VKP6',
  'GB34MSC46ZRA2J75FY4XH5QQ5A6UYFBZXUZCNUYCVC7VLCIOYHG4QMVT',
];

const rescueDestinations = document.getElementById('rescue-destinations');
const scheduleDatetime = document.getElementById('schedule-datetime');
const scheduleAddBtn = document.getElementById('schedule-add-btn');
const scheduleList = document.getElementById('schedule-list');
const rescueActivateBtn = document.getElementById('rescue-activate-btn');
const rescueDeactivateBtn = document.getElementById('rescue-deactivate-btn');
const rescueStatus = document.getElementById('rescue-status');
const rescueError = document.getElementById('rescue-error');
const accountDetailsBtn = document.getElementById('account-details-btn');
const accountDetailsDiv = document.getElementById('account-details');
const createAccountBtn = document.getElementById('create-account-btn');
const createAccountResult = document.getElementById('create-account-result');

let schedules = [];
let rescueActive = false;
let rescueTimer = null;
const RESCUE_CHECK_INTERVAL = 10000;

function setMinDatetime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  scheduleDatetime.min = now.toISOString().slice(0, 16);
}
setMinDatetime();

function renderDestinations() {
  rescueDestinations.innerHTML = RESCUE_DESTINATIONS.map(addr =>
    `<div class="addr-item"><span class="addr-label">Destination</span>${shortenAddr(addr)}</div>`
  ).join('');
}

function renderSchedules() {
  if (schedules.length === 0) {
    scheduleList.innerHTML = '<p class="card-desc" style="margin-bottom:0;">No sweeps scheduled.</p>';
    return;
  }
  scheduleList.innerHTML = schedules.map(s => {
    const time = new Date(s.scheduledAt);
    const local = time.toLocaleString();
    const utc = time.toUTCString();
    const STATUS_MAP = {
      scheduled: { label: 'Scheduled', cls: 'scheduled' },
      queued: { label: 'Queued', cls: 'queued' },
      executing: { label: 'Executing…', cls: 'executing' },
      executed: { label: 'Executed', cls: 'executed' },
      failed: { label: 'Failed', cls: 'failed' },
    };
    const st = STATUS_MAP[s.status] || STATUS_MAP.failed;
    return `
      <div class="sched-item">
        <div class="sched-info">
          <div class="sched-label">${s.label || 'Sweep'}</div>
          <div class="sched-time">${local} / ${utc}</div>
          ${s.error ? `<div class="sched-error">${s.error}</div>` : ''}
        </div>
        <span class="sched-badge ${st.cls}">${st.label}</span>
        <button class="sched-remove" data-id="${s.id}">&times;</button>
      </div>
    `;
  }).join('');

  scheduleList.querySelectorAll('.sched-remove').forEach(btn => {
    btn.addEventListener('click', () => removeSchedule(btn.dataset.id));
  });
}

function loadSchedules() {
  try {
    const saved = localStorage.getItem('rescuepi-schedules');
    schedules = saved ? JSON.parse(saved) : [];
  } catch { schedules = []; }
  renderSchedules();
}

function saveSchedules() {
  localStorage.setItem('rescuepi-schedules', JSON.stringify(schedules));
  renderSchedules();
}

scheduleAddBtn.addEventListener('click', () => {
  const val = scheduleDatetime.value;
  if (!val) return;
  const scheduledAt = new Date(val).toISOString();
  const id = 'sweep_' + Date.now();
  schedules.push({ id, scheduledAt, label: 'Sweep', status: 'scheduled' });
  saveSchedules();
  scheduleDatetime.value = '';
  setMinDatetime();
  scheduleAddBtn.disabled = true;
});

scheduleDatetime.addEventListener('input', () => {
  const val = scheduleDatetime.value;
  scheduleAddBtn.disabled = !val || new Date(val) <= new Date();
});

function removeSchedule(id) {
  schedules = schedules.filter(s => s.id !== id);
  saveSchedules();
}

async function sweepAll(feeMultiplier) {
  feeMultiplier = feeMultiplier || 10;
  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(walletPublicKey);
  const baseFee = await server.fetchBaseFee();

  const nativeBalance = account.balances.find(b => b.asset_type === 'native');
  if (!nativeBalance) throw new Error('No native balance found');
  const totalBalance = parseFloat(nativeBalance.balance);
  const balStroops = Math.round(totalBalance * 1e7);

  const filtered = RESCUE_DESTINATIONS.filter(a => a !== walletPublicKey);
  if (filtered.length === 0) throw new Error('No destinations to sweep to');

  const perOpFee = baseFee * feeMultiplier || 100000;
  const totalFeeStroops = perOpFee * filtered.length;
  const minBalanceStroops = 5000000;
  const sweepStroops = balStroops - totalFeeStroops - minBalanceStroops;

  if (sweepStroops <= 0) throw new Error('Insufficient balance after fee and reserve');
  const perWalletStroops = Math.floor(sweepStroops / filtered.length);
  if (perWalletStroops < 1000000) throw new Error('Amount per destination too small (min 0.1 PI)');

  const txBuilder = new TransactionBuilder(account, {
    fee: (perOpFee * filtered.length).toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  for (const dest of filtered) {
    txBuilder.addOperation(
      Operation.payment({
        destination: dest,
        asset: Asset.native(),
        amount: (perWalletStroops / 1e7).toFixed(7),
      })
    );
  }

  txBuilder.setTimeout(30);
  const tx = txBuilder.build();
  tx.sign(walletKeypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

async function checkAndExecuteSchedules() {
  if (!walletKeypair || schedules.length === 0) return;
  const now = Date.now();
  let changed = false;

  for (const s of schedules) {
    if (s.status === 'scheduled' && new Date(s.scheduledAt).getTime() <= now) {
      s.status = 'queued';
      changed = true;
    }
  }

  const toExecute = schedules.filter(s => s.status === 'queued' || s.status === 'executing');
  for (const sweep of toExecute) {
    sweep.status = 'executing';
    saveSchedules();
    try {
      const hash = await sweepAll(10);
      sweep.status = 'executed';
      sweep.executedAt = new Date().toISOString();
      delete sweep.error;
      changed = true;
    } catch (err) {
      sweep.status = 'failed';
      sweep.error = err.message || err.toString();
      changed = true;
    }
  }

  if (changed) saveSchedules();
}

function activateRescue() {
  if (rescueActive) return;
  rescueActive = true;
  rescueActivateBtn.classList.add('hidden');
  rescueDeactivateBtn.classList.remove('hidden');
  rescueStatus.textContent = 'Rescue mode active.';
  rescueStatus.classList.remove('hidden');
  rescueError.classList.add('hidden');

  rescueTimer = setInterval(() => {
    checkAndExecuteSchedules().catch(() => {});
  }, RESCUE_CHECK_INTERVAL);

  checkAndExecuteSchedules().catch(() => {});
}

function deactivateRescue() {
  rescueActive = false;
  if (rescueTimer) {
    clearInterval(rescueTimer);
    rescueTimer = null;
  }
  rescueActivateBtn.classList.remove('hidden');
  rescueDeactivateBtn.classList.add('hidden');
  rescueStatus.classList.add('hidden');
}

rescueActivateBtn.addEventListener('click', activateRescue);
rescueDeactivateBtn.addEventListener('click', deactivateRescue);

// ─── Account Details ───
accountDetailsBtn.addEventListener('click', async () => {
  accountDetailsBtn.disabled = true;
  accountDetailsBtn.textContent = 'Loading…';
  accountDetailsDiv.classList.add('hidden');

  try {
    const server = new Horizon.Server(HORIZON_URL);
    const account = await server.loadAccount(walletPublicKey);
    const allOps = await server.operations()
      .forAccount(walletPublicKey)
      .limit(200)
      .order('asc')
      .call();

    const firstOp = allOps.records[0];
    const accCreationTime = firstOp?.created_at || 'N/A';

    const lastOps = await server.operations()
      .forAccount(walletPublicKey)
      .limit(1)
      .order('desc')
      .call();
    const lastOpTime = lastOps.records[0]?.created_at || 'N/A';

    const claimBalOps = allOps.records.filter(r => r.type === 'create_claimable_balance');
    const claimedIds = new Set(
      allOps.records.filter(r => r.type === 'claim_claimable_balance').map(r => r.balance_id)
    );

    let lockups = [];
    for (const op of claimBalOps) {
      const forUser = op.claimants?.find(c => c.destination === walletPublicKey);
      if (!forUser) continue;
      const relBefore = parseInt(forUser.predicate?.rel_before || forUser.predicate?.not?.rel_before || '0');
      const unlockTime = new Date(new Date(op.created_at).getTime() + relBefore * 1000);
      const balanceId = op.id;
      lockups.push({
        id: balanceId,
        amount: op.amount,
        createdAt: op.created_at,
        unlockTime,
        claimed: claimedIds.has(op.balance_id),
      });
    }

    const nativeBalance = account.balances.find(b => b.asset_type === 'native');
    const availableBalance = nativeBalance ? parseFloat(nativeBalance.balance) : 0;
    const lockedTotal = lockups.filter(l => !l.claimed).reduce((s, l) => s + parseFloat(l.amount), 0);

    let html = '<div class="ad-section">';
    html += `<div class="ad-row"><span class="ad-label">Account</span><span class="ad-mono">${shortenAddr(walletPublicKey)}</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">Sequence</span><span class="ad-mono">${account.sequence}</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">Created</span><span>${new Date(accCreationTime).toLocaleString()}</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">Last Operation</span><span>${new Date(lastOpTime).toLocaleString()}</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">Subentries</span><span>${account.subentry_count}</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">Signers</span><span>${account.signers.length}</span></div>`;
    html += '</div>';

    html += '<div class="ad-section"><div class="ad-section-title">Balances</div>';
    html += `<div class="ad-row"><span class="ad-label">Available</span><span class="ad-mono">${availableBalance.toFixed(7)} PI</span></div>`;
    if (lockedTotal > 0) {
      html += `<div class="ad-row" style="color:var(--danger);"><span class="ad-label">Locked (on-chain)</span><span class="ad-mono">${lockedTotal.toFixed(7)} PI</span></div>`;
    }
    html += '</div>';

    if (lockups.length > 0) {
      html += '<div class="ad-section"><div class="ad-section-title">Lockups / Unlock Schedule</div>';
      for (const l of lockups) {
        const status = l.claimed
          ? '<span style="color:var(--success);">Claimed</span>'
          : `<span style="color:var(--danger);">Locked until ${l.unlockTime.toLocaleString()}</span>`;
        html += `<div class="ad-row ad-row-col">
          <div><span class="ad-label">${l.claimed ? 'Claimed' : 'Locked'}</span><span class="ad-mono">${parseFloat(l.amount).toFixed(7)} PI</span></div>
          <div style="font-size:12px;color:var(--text-muted);">${status}</div>
        </div>`;
      }
      html += '</div>';
    }

    html += '<div class="ad-section"><div class="ad-section-title">Flags</div>';
    const flags = account.flags;
    html += `<div class="ad-row"><span class="ad-label">Auth Required</span><span>${flags.auth_required ? 'Yes' : 'No'}</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">Auth Revocable</span><span>${flags.auth_revocable ? 'Yes' : 'No'}</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">Auth Immutable</span><span>${flags.auth_immutable ? 'Yes' : 'No'}</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">Auth Clawback</span><span>${flags.auth_clawback_enabled ? 'Yes' : 'No'}</span></div>`;
    html += '</div>';

    accountDetailsDiv.innerHTML = html;
    accountDetailsDiv.classList.remove('hidden');
  } catch (err) {
    accountDetailsDiv.innerHTML = `<div class="error" style="margin:0;">${err.message || 'Failed to load account details'}</div>`;
    accountDetailsDiv.classList.remove('hidden');
  } finally {
    accountDetailsBtn.disabled = false;
    accountDetailsBtn.textContent = 'Load Account Details';
  }
});

// ─── Create Account ───
createAccountBtn.addEventListener('click', async () => {
  createAccountBtn.disabled = true;
  createAccountBtn.textContent = 'Creating…';
  createAccountResult.classList.add('hidden');

  try {
    const server = new Horizon.Server(HORIZON_URL);
    const account = await server.loadAccount(walletPublicKey);
    const baseFee = await server.fetchBaseFee();

    const newPair = Keypair.random();
    const newPublic = newPair.publicKey();
    const newSecret = newPair.secret();

    const tx = new TransactionBuilder(account, {
      fee: (baseFee * 10).toString(),
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.createAccount({
          destination: newPublic,
          startingBalance: '1.0000000',
        })
      )
      .setTimeout(30)
      .build();

    tx.sign(walletKeypair);
    const result = await server.submitTransaction(tx);

    let html = '<div class="ad-section">';
    html += `<div class="ad-row" style="color:var(--success);"><span class="ad-label">Status</span><span>Success</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">New Account</span><span class="ad-mono">${newPublic}</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">Secret Key</span><span class="ad-mono" style="font-size:11px;color:var(--text-muted);">${newSecret}</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">Funding</span><span class="ad-mono">1.0000000 PI</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">TX Hash</span><span class="ad-mono" style="font-size:11px;">${result.hash}</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">Type</span><span>create_account (type_i: 0)</span></div>`;
    html += '</div>';
    html += '<p style="font-size:12px;color:var(--text-muted);margin-top:8px;text-align:center;">Account creation succeeded! Pi Network allows it.</p>';

    createAccountResult.innerHTML = html;
    createAccountResult.classList.remove('hidden');
  } catch (err) {
    const detail = err.response?.data?.detail || err.response?.data?.title || err.message;
    let html = '<div class="ad-section">';
    html += `<div class="ad-row" style="color:var(--danger);"><span class="ad-label">Status</span><span>Failed</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">Error</span><span style="font-size:12px;color:var(--danger);">${detail}</span></div>`;
    html += `<div class="ad-row"><span class="ad-label">Type</span><span>create_account (type_i: 0)</span></div>`;
    html += '</div>';
    html += '<p style="font-size:12px;color:var(--text-muted);margin-top:8px;text-align:center;">Account creation blocked on Pi mainnet.</p>';

    createAccountResult.innerHTML = html;
    createAccountResult.classList.remove('hidden');
  } finally {
    createAccountBtn.disabled = false;
    createAccountBtn.textContent = 'Create Account';
  }
});

// ─── Restore session ───
(function init() {
  const saved = localStorage.getItem('rescuepi-user');
  if (saved) {
    try {
      const auth = JSON.parse(saved);
      currentUser = auth.user;
      Pi.authenticate(['username', 'wallet_address', 'payments'], onIncompletePayment)
        .then(() => {
          authScreen.classList.add('hidden');
          walletImportScreen.classList.remove('hidden');
        })
        .catch(() => localStorage.removeItem('rescuepi-user'));
    } catch {
      localStorage.removeItem('rescuepi-user');
    }
  }
})();
