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
    const { mnemonicToSeedSync } = await import('bip39');
    const { derivePath } = await import('ed25519-hd-key');
    const seed = mnemonicToSeedSync(mnemonic);
    const derived = derivePath("m/44'/314159'/0'", seed.toString('hex'));
    walletKeypair = Keypair.fromRawEd25519Seed(derived.key);
    walletPublicKey = walletKeypair.publicKey();

    walletImportScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    showMainScreen();
  } catch (err) {
    importError.textContent = 'Invalid mnemonic. Check your phrase and try again.';
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
}

// ─── Logout ───
logoutBtn.addEventListener('click', () => {
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
