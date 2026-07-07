// ─── Pi SDK Setup ───
Pi.init({ version: '2.0' });

let currentUser = null;
let sentTxid = null;

// ─── DOM refs ───
const authScreen = document.getElementById('auth-screen');
const mainScreen = document.getElementById('main-screen');
const authBtn = document.getElementById('auth-btn');
const authError = document.getElementById('auth-error');
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

// ─── Fee slider ───
feeSlider.addEventListener('input', () => {
  const val = parseInt(feeSlider.value);
  const fee = (0.01 * val).toFixed(2);
  sendFee.textContent = fee;
});

// ─── Auth ───
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

    showMainScreen();
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

function showMainScreen() {
  authScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
  welcomeMsg.textContent = `Hello, ${currentUser.username || 'Pioneer'}`;
  walletAddr.textContent = `Wallet: ${currentUser.wallet_address || 'Not available'}`;
  if (currentUser.username) {
    userName.textContent = `@${currentUser.username}`;
  }
}

// ─── Logout ───
logoutBtn.addEventListener('click', () => {
  currentUser = null;
  localStorage.removeItem('rescuepi-user');
  mainScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
  sendTo.value = '';
  sendAmount.value = '';
  feeSlider.value = '1';
  sendFee.textContent = '0.01';
  sendError.classList.add('hidden');
  sendStatus.classList.add('hidden');
});

// ─── Send validation ───
function validateForm() {
  const to = sendTo.value.trim();
  const amt = sendAmount.value.trim();
  const valid = to.startsWith('G') && parseFloat(amt) > 0;
  sendBtn.disabled = !valid;
}

sendTo.addEventListener('input', validateForm);
sendAmount.addEventListener('input', validateForm);

// ─── Send ───
sendBtn.addEventListener('click', async () => {
  sendError.classList.add('hidden');
  sendStatus.classList.add('hidden');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending…';

  const to = sendTo.value.trim();
  const amt = sendAmount.value.trim();
  const feeMult = parseInt(feeSlider.value);
  const feeAmount = (0.01 * feeMult).toFixed(2);

  try {
    Pi.createPayment({
      amount: parseFloat(amt),
      memo: `RescuePi send to ${to.slice(0, 8)}`,
      metadata: { destination: to, feeMultiplier: feeMult },
    }, {
      onReadyForServerApproval: async (paymentId) => {
        console.log('Payment ready for approval:', paymentId);
      },
      onReadyForServerCompletion: async (paymentId, txid) => {
        console.log('Payment completed:', paymentId, txid);
        sentTxid = txid;
      },
      onCancel: (paymentId) => {
        sendError.textContent = 'Payment was cancelled';
        sendError.classList.remove('hidden');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
      },
      onError: (error, payment) => {
        sendError.textContent = error.message || 'Payment failed';
        sendError.classList.remove('hidden');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
      },
    });
  } catch (err) {
    sendError.textContent = err.message || 'Failed to initiate payment';
    sendError.classList.remove('hidden');
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
        .then(() => showMainScreen())
        .catch(() => {
          localStorage.removeItem('rescuepi-user');
        });
    } catch {
      localStorage.removeItem('rescuepi-user');
    }
  }
})();
