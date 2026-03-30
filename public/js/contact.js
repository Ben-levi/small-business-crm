const form = document.getElementById('contactForm');
const alert = document.getElementById('alert');
const submitBtn = document.getElementById('submitBtn');

function showAlert(msg, type) {
  alert.textContent = msg;
  alert.className = `alert alert-${type}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = 'שולח…';

  const body = {
    name:             document.getElementById('name').value.trim(),
    email:            document.getElementById('email').value.trim(),
    phone:            document.getElementById('phone').value.trim(),
    message:          document.getElementById('message').value.trim(),
    turnstileToken:   document.querySelector('[name="cf-turnstile-response"]')?.value || '',
  };

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      showAlert('תודה! ההודעה התקבלה. ניצור איתך קשר בקרוב.', 'success');
      form.reset();
    } else {
      showAlert(data.message || 'אירעה שגיאה. נסה שוב.', 'error');
    }
  } catch {
    showAlert('שגיאת רשת. נסה שוב מאוחר יותר.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'שלח הודעה';
  }
});
