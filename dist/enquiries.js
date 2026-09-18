const initializedForms = new WeakSet();

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function validateEnquiry(form) {
  const fields = [...form.elements].filter(field => ['INPUT', 'SELECT', 'TEXTAREA'].includes(field.tagName));
  fields.forEach(field => {
    field.setCustomValidity('');
    field.removeAttribute('aria-invalid');
    if (field.type !== 'checkbox' && field.type !== 'radio') field.value = field.value.trim();
    if (field.required && !field.value.trim()) field.setCustomValidity('Please complete this field.');
    if (field.name === 'phone' && field.value) {
      const digits = field.value.replace(/\D/g, '');
      if (!/^\+?[\d\s().-]+$/.test(field.value) || digits.length < 7 || digits.length > 15) field.setCustomValidity('Enter a valid phone number with 7–15 digits, including the country code.');
    }
    if (field.type === 'number' && field.value && (!Number.isFinite(Number(field.value)) || Number(field.value) <= 0)) field.setCustomValidity('Enter a number greater than zero.');
  });
  const invalid = fields.filter(field => !field.checkValidity());
  invalid.forEach(field => field.setAttribute('aria-invalid', 'true'));
  if (invalid.length) {
    invalid[0].reportValidity();
    invalid[0].focus();
    return false;
  }
  return true;
}

function bindEnquiry(form) {
  const result = form.querySelector('.form-result');
  if (!result) return;
  const clearPreview = () => {
    result.replaceChildren();
    result.hidden = true;
  };
  form.addEventListener('input', event => {
    clearPreview();
    if (event.target.setCustomValidity) event.target.setCustomValidity('');
    event.target.removeAttribute('aria-invalid');
  });
  form.addEventListener('change', clearPreview);
  form.addEventListener('submit', event => {
    event.preventDefault();
    clearPreview();
    if (!validateEnquiry(form)) return;
    const data = Object.fromEntries(new FormData(form));
    const isQuote = form.dataset.enquiry === 'quote';
    const lines = [isQuote ? 'Hello 3A Logistics, I would like a shipping quote.' : 'Hello 3A Logistics, I would like to make an enquiry.', '', `Name: ${data.name}`, ...(data.company ? [`Company: ${data.company}`] : []), `Email: ${data.email}`, `Phone: ${data.phone}`];
    if (isQuote) {
      lines.push('', `Pickup: ${data.pickup}`, `Destination: ${data.destination}`, `Shipment: ${data.shipmentType}`, `Packages: ${data.quantity}`, `Total weight: ${data.weight} kg`);
      if (data.length || data.width || data.height) lines.push(`Dimensions per package (L × W × H): ${data.length || 'not provided'} × ${data.width || 'not provided'} × ${data.height || 'not provided'} cm`);
      lines.push(`Delivery preference: ${data.deliveryPreference}`);
    }
    lines.push('', `Message: ${data.message}`);
    const message = lines.join('\n');
    result.append(makeElement('h3', '', 'Your enquiry is ready to review.'), makeElement('p', '', 'Nothing has been sent. Review your details below, then continue in WhatsApp and choose Send.'));
    const preview = makeElement('pre', 'tx-message-preview', message);
    const link = makeElement('a', 'btn btn-dark', 'Continue in WhatsApp ↗');
    link.href = `https://wa.me/918652631182?text=${encodeURIComponent(message)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    result.append(preview, link);
    result.hidden = false;
    result.tabIndex = -1;
    result.focus({ preventScroll: true });
    result.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
  });
  // The static form starts disabled so it cannot submit personal details by GET
  // before this handler is ready, or when JavaScript is unavailable.
  form.querySelectorAll('[type="submit"]').forEach(button => { button.disabled = false; });
}

export function initEnquiries() {
  document.querySelectorAll('form[data-enquiry]').forEach(form => {
    if (initializedForms.has(form)) return;
    initializedForms.add(form);
    bindEnquiry(form);
  });
}
