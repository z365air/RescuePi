Pi.init({ version: '2.0' });

let currentUser = null;
let currentPaymentId = null;

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

feeSlider.addEventListener('input', () => {
  const val = parseInt(feeSlider.value);
  sendFee.textContent = (0.01 * val).toFixed(2);
});

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

function validateForm() {
  const to = sendTo.value.trim();
  const amt = sendAmount.value.trim();
  sendBtn.disabled = !(to.startsWith('G') && parseFloat(amt) > 0);
}

sendTo.addEventListener('input', validateForm);
sendAmount.addEventListener('input', validateForm);

sendBtn.addEventListener('click', async () => {
  sendError.classList.add('hidden');
  sendStatus.classList.add('hidden');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Initiating…';

  const to = sendTo.value.trim();
  const amt = sendAmount.value.trim();
  const feeMult = parseInt(feeSlider.value);

  Pi.createPayment({
    amount: parseFloat(amt),
    memo: `RescuePi → ${to.slice(0, 8)}`,
    metadata: { destination: to, feeMultiplier: feeMult },
  }, {
    onReadyForServerApproval: async (paymentId) => {
      currentPaymentId = paymentId;
      sendStatus.textContent = 'Approving payment…';
      sendStatus.classList.remove('hidden');

      try {
        const res = await fetch('/api/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Approval failed');
        sendStatus.textContent = 'Approved! Check your Pi Wallet to sign…';
      } catch (err) {
        sendError.textContent = err.message;
        sendError.classList.remove('hidden');
      }
    },

    onReadyForServerCompletion: async (paymentId, txid) => {
      sendStatus.textContent = 'Completing payment…';

      try {
        const res = await fetch('/api/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId, txid }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Completion failed');

        sendStatus.textContent = `Sent! TX: ${txid}`;
        currentPaymentId = null;
        sendTo.value = '';
        sendAmount.value = '';
      } catch (err) {
        sendError.textContent = err.message;
        sendError.classList.remove('hidden');
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
      }
    },

    onCancel: (paymentId) => {
      currentPaymentId = null;
      sendError.textContent = 'Payment cancelled';
      sendError.classList.remove('hidden');
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
    },

    onError: (error, payment) => {
      currentPaymentId = null;
      sendError.textContent = error.message || 'Payment failed';
      sendError.classList.remove('hidden');
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
    },
  });
});

(function init() {
  const saved = localStorage.getItem('rescuepi-user');
  if (saved) {
    try {
      const auth = JSON.parse(saved);
      currentUser = auth.user;
      Pi.authenticate(['username', 'wallet_address', 'payments'], onIncompletePayment)
        .then(() => showMainScreen())
        .catch(() => localStorage.removeItem('rescuepi-user'));
    } catch {
      localStorage.removeItem('rescuepi-user');
    }
  }
})();
