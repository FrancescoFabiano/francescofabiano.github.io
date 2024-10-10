const links = document.querySelectorAll("#main-nav a");
const sections = document.querySelectorAll("main section");

// update active nav links on scroll
// source: https://javascript.tutorialink.com/add-class-active-on-scroll-vanilla-js/

var scrollOffsetTop;
var setScrollOffsetTop = () => {scrollOffsetTop = window.innerHeight / 2;}
setScrollOffsetTop();
window.addEventListener('resize', setScrollOffsetTop);

function changeLinkState() {
  let index = sections.length;

  while (--index && window.scrollY + scrollOffsetTop < sections[index].offsetTop) {}

  links.forEach((link) => link.classList.remove('active'));

  // add the active class if within visible height of the element
  if (scrollY - sections[index].offsetHeight < sections[index].offsetTop) {
    links[index].classList.add('active');
  }
}

changeLinkState();
window.addEventListener('scroll', changeLinkState);


sections.forEach((section) => {
    const sectionHeight = section.offsetHeight;
    const halfViewportHeight = window.innerHeight*3 / 4;

    if (section.id === 'education') {
      // Adjust the margin-top to remove extra space
      section.style.setProperty('--header-height-offset', `calc(0px + (15vh)`);
    } else if (section.id === 'experience'  || section.id === 'resources') {
      section.style.setProperty('--header-height-offset', `calc(0px + (7vh)`);
    } else {
      section.style.setProperty('--header-height-offset', `calc(0px + (0vh)`);
    }
  });