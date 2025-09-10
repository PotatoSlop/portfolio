function sendEmail(event) {
  event.preventDefault();
  
  // Get form values and trim whitespace
  var name = document.getElementById('name').value.trim();
  var email = document.getElementById('email').value.trim();
  var phone = document.getElementById('phone').value.trim();
  var message = document.getElementById('message').value.trim();
  
  clearErrorMessages();
  clearFormMessages();

  var hasErrors = false;

  // #region Validation Checks
  if (!name) {
    hasErrors = true;
    showError('name', 'Full name is required');
  } 
  else if (name.length < 2) {
    hasErrors = true;
    showError('name', 'Name must be at least 2 characters long');
  }

  if (!email) {
    hasErrors = true;
    showError('email', 'Email address is required');
  } 
  else if (!isValidEmail(email)) {
    hasErrors = true;
    showError('email', 'Please enter a valid email address');
  }

  // Phone validate format
  if (phone && !isValidPhone(phone)) {
    hasErrors = true;
    showError('phone', 'Please enter a valid phone number in format: (555) 123-4567');
  }

  if (!message) {
    hasErrors = true;
    showError('message', 'Message is required');
  } 
  else if (message.length < 50) {
    hasErrors = true;
    showError('message', `Message must be at least 50 characters long. ${50 - message.length} characters remaining.`);
  } 
  else if (message.length > 2000) {
    hasErrors = true;
    showError('message', `Message is too long. Please reduce by ${message.length - 2000} characters.`);
  }

  if (hasErrors) {
    focusFirstErrorField();
    showFormMessage('Please correct the errors below and try again.', 'error');
    return;
  }
  
  // #endregion 

  //Formatting
  var fromField = document.getElementById('from_field');
  fromField.value = name + ' <' + email + '>';

  var submitButton = event.target.querySelector('button[type="submit"]');
  setButtonLoading(submitButton, true);

  emailjs.sendForm('service_48b6ao1', 'template_rn6shkd', event.target)
    .then(function() {
      showFormMessage('Thank you! Your message has been sent successfully. I\'ll get back to you soon.', 'success');
      event.target.reset();
      clearErrorMessages();
      updateMessageCounter();
      resetFieldStates();
    }, 
    function(error) {
      console.error('EmailJS Error:', error);
      showFormMessage('Sorry, there was a problem sending your message. Please try again or contact me directly.', 'error');
    })
    .finally(function() {
      setButtonLoading(submitButton, false);
    });
}

// #region Helper Functions
function isValidEmail(email) {
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

function isValidPhone(phone) {
  var phonePattern = /^\(\d{3}\) \d{3}-\d{4}$/;
  return phonePattern.test(phone);
}

function showError(fieldId, message) {
  var field = document.getElementById(fieldId);
  var errorDiv = document.getElementById(fieldId + '-error');

  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  field.classList.add('error-field');
  field.classList.remove('success-field');
  
  field.setAttribute('aria-invalid', 'true');
}

function clearError(fieldId) {
  var errorDiv = document.getElementById(fieldId + '-error');
  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.style.display = 'none';
  }
  
  var field = document.getElementById(fieldId);
  field.classList.remove('error-field');
  field.setAttribute('aria-invalid', 'false');
}

function showSuccess(fieldId) {
  var field = document.getElementById(fieldId);
  field.classList.add('success-field');
  field.classList.remove('error-field');
  field.setAttribute('aria-invalid', 'false');
}

function clearErrorMessages() {
  var errorMessages = document.querySelectorAll('.error-message');
  errorMessages.forEach(function(message) {
    message.textContent = '';
    message.style.display = 'none';
  });
  
  var errorFields = document.querySelectorAll('.error-field');
  errorFields.forEach(function(field) {
    field.classList.remove('error-field');
    field.setAttribute('aria-invalid', 'false');
  });
}

function resetFieldStates() {
  var allFields = document.querySelectorAll('input, textarea');
  allFields.forEach(function(field) {
    field.classList.remove('error-field', 'success-field');
    field.setAttribute('aria-invalid', 'false');
  });
}

function focusFirstErrorField() {
  var firstErrorField = document.querySelector('.error-field');
  if (firstErrorField) {
    firstErrorField.focus();
  }
}

function showFormMessage(message, type) {
  var messageDiv = document.getElementById('form-messages');
  messageDiv.textContent = message;
  messageDiv.className = 'form-messages ' + type;
  messageDiv.style.display = 'block';
  
  messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearFormMessages() {
  var messageDiv = document.getElementById('form-messages');
  messageDiv.style.display = 'none';
  messageDiv.className = 'form-messages';
}

function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.classList.add('loading');
    button.querySelector('.button-text').textContent = 'Sending...';
  } else {
    button.disabled = false;
    button.classList.remove('loading');
    button.querySelector('.button-text').textContent = 'Send Message';
  }
}

function updateMessageCounter() {
  var messageField = document.getElementById('message');
  var counter = document.getElementById('message-counter');
  var currentLength = messageField.value.length;
  var minLength = 50;
  var maxLength = 2000;
  
  counter.textContent = currentLength + '/' + minLength;
  
  // Update counter styling based on length
  counter.classList.remove('warning', 'valid');
  if (currentLength >= minLength) {
    counter.classList.add('valid');
    counter.textContent = currentLength + '/' + maxLength;
  } else if (currentLength > minLength * 0.8) {
    counter.classList.add('warning');
  }
}

function setupRealTimeValidation() {
  var nameField = document.getElementById('name');
  var emailField = document.getElementById('email');
  var phoneField = document.getElementById('phone');
  var messageField = document.getElementById('message');
  
  // Name field validation
  if (nameField) {
    nameField.addEventListener('blur', function() {
      var name = this.value.trim();
      clearError('name');
      if (name && name.length >= 2) {
        showSuccess('name');
      } else if (name && name.length < 2) {
        showError('name', 'Name must be at least 2 characters long');
      }
    });
    
    nameField.addEventListener('input', function() {
      if (this.classList.contains('error-field')) {
        clearError('name');
      }
    });
  }

  // Email field validation
  if (emailField) {
    emailField.addEventListener('blur', function() {
      var email = this.value.trim();
      clearError('email');
      if (email && isValidEmail(email)) {
        showSuccess('email');
      } else if (email && !isValidEmail(email)) {
        showError('email', 'Please enter a valid email address');
      }
    });
    
    emailField.addEventListener('input', function() {
      if (this.classList.contains('error-field')) {
        clearError('email');
      }
    });
  }

  // Phone field validation
  if (phoneField) {
    phoneField.addEventListener('blur', function() {
      var phone = this.value.trim();
      clearError('phone');
      if (phone && isValidPhone(phone)) {
        showSuccess('phone');
      } else if (phone && !isValidPhone(phone)) {
        showError('phone', 'Please enter a valid phone number in format: (555) 123-4567');
      }
    });
  }

  // Message field validation
  if (messageField) {
    messageField.addEventListener('input', function() {
      updateMessageCounter();
      if (this.classList.contains('error-field')) {
        clearError('message');
      }
    });
    
    messageField.addEventListener('blur', function() {
      var message = this.value.trim();
      clearError('message');
      if (message && message.length >= 50) {
        showSuccess('message');
      } else if (message && message.length < 50) {
        showError('message', `Message must be at least 50 characters long. ${50 - message.length} characters remaining.`);
      }
    });
  }
}

function setupPhoneFormatting() {
  var phoneInput = document.getElementById('phone');
  
  if (phoneInput) {
    phoneInput.addEventListener('input', function(e) {
      let x = phoneInput.value.replace(/\D/g, '').substring(0, 10);
      let formatted = '';
      if (x.length > 0) {
        formatted = '(' + x.substring(0, 3);
      }
      if (x.length >= 4) {
        formatted += ') ' + x.substring(3, 6);
      }
      if (x.length >= 7) {
        formatted += '-' + x.substring(6, 10);
      }
      phoneInput.value = formatted;
    });
  }
}

function adjustTextareaHeight() {
  var textarea = document.getElementById('message');
  if (textarea) {
    var viewportHeight = window.innerHeight;
    var minHeight, maxHeight, height;
    
    if (window.innerWidth <= 768) {
      // Mobile
      minHeight = Math.max(120, Math.floor(viewportHeight * 0.25) - 80);
      maxHeight = Math.max(180, Math.floor(viewportHeight * 0.35) - 80);
      height = Math.max(150, Math.floor(viewportHeight * 0.30) - 80);
    } else if (viewportHeight <= 600) {
      // Short viewport
      minHeight = 120;
      maxHeight = 180;
      height = 150;
    } else {
      // Desktop
      minHeight = Math.floor(viewportHeight * 0.30) - 100;
      maxHeight = Math.floor(viewportHeight * 0.40) - 100;
      height = Math.floor(viewportHeight * 0.35) - 100;
    }
    
    textarea.style.minHeight = minHeight + 'px';
    textarea.style.maxHeight = maxHeight + 'px';
    textarea.style.height = height + 'px';
  }
}

// #endregion

document.addEventListener('DOMContentLoaded', function() {
  var form = document.querySelector('form');
  
  if (form) {
    form.addEventListener('submit', sendEmail);
  }

  setupRealTimeValidation();
  setupPhoneFormatting();
  adjustTextareaHeight();
  updateMessageCounter();
  
  // Clear form messages when user starts typing
  var inputs = document.querySelectorAll('input, textarea');
  inputs.forEach(function(input) {
    input.addEventListener('input', function() {
      clearFormMessages();
    });
  });
  
  window.addEventListener('resize', adjustTextareaHeight);
});