// dom.test.js
describe('DOM manipulation', () => {
  test('should add a class to an element', () => {
    document.body.innerHTML = '<div id="myElement"></div>';
    const element = document.getElementById('myElement');
    element.classList.add('new-class');
    expect(element.classList.contains('new-class')).toBe(true);
  });
});
