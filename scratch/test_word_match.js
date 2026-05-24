const isWordMatch = (header, variant) => {
  const escaped = variant.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const startBoundary = /^[a-z0-9]/i.test(variant) ? '\\b' : '';
  const endBoundary = /[a-z0-9]$/i.test(variant) ? '\\b' : '';
  const regex = new RegExp(startBoundary + escaped + endBoundary);
  return regex.test(header);
};

console.log('hotel name / tel:', isWordMatch('hotel name', 'tel')); // should be false
console.log('total / ota:', isWordMatch('room revenue total', 'ota')); // should be false
console.log('e-mail / e-mail:', isWordMatch('my e-mail address', 'e-mail')); // should be true
console.log('conf # / conf #:', isWordMatch('room conf #', 'conf #')); // should be true
console.log('grand total / total:', isWordMatch('grand total', 'total')); // should be true
console.log('guide / id:', isWordMatch('room guide', 'id')); // should be false
console.log('guest id / id:', isWordMatch('guest id', 'id')); // should be true
