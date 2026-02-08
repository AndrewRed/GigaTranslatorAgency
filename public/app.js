const form = document.getElementById('translator-form');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const submitBtn = document.getElementById('submit-btn');

const persistedFields = ['baseUrl', 'apiKey', 'model'];

for (const field of persistedFields) {
  const element = document.getElementById(field);
  const saved = localStorage.getItem(`gta:${field}`);
  if (saved) {
    element.value = saved;
  }

  element.addEventListener('change', () => {
    localStorage.setItem(`gta:${field}`, element.value.trim());
  });
}

function setStatus(message) {
  statusEl.textContent = message;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Отправляем текст на литературный перевод...');
  submitBtn.disabled = true;
  resultEl.value = '';

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Неизвестная ошибка сервера.');
    }

    resultEl.value = data.translation;
    setStatus('Готово. Перевод получен.');
  } catch (error) {
    setStatus(`Ошибка: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
  }
});
