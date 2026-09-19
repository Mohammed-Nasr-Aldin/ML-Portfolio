// Mobile Menu Toggle with Smooth Transition
const mobileMenu = document.getElementById('mobile-menu');
const navList = document.getElementById('nav-list');

mobileMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    navList.classList.toggle('active');
});

// Close menu & smooth scroll with motion
document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        navList.classList.remove('active');
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!navList.contains(e.target) && !mobileMenu.contains(e.target)) {
        navList.classList.remove('active');
    }
});

// Close menu & scroll to top smoothly when clicking logo
const logoTop = document.getElementById('logo-top');
logoTop.addEventListener('click', (e) => {
    navList.classList.remove('active');
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Scroll Reveal Animation
const revealElements = document.querySelectorAll('.reveal');

const revealCallback = (entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
};

const revealObserver = new IntersectionObserver(revealCallback, { threshold: 0.1 });
revealElements.forEach(el => revealObserver.observe(el));

// Resume Modal Logic
const resumeModal = document.getElementById('resume-modal');
const openResumeBtn = document.getElementById('open-resume-btn');
const closeResumeModal = document.getElementById('close-resume-modal');

openResumeBtn.addEventListener('click', () => { resumeModal.style.display = 'flex'; });
closeResumeModal.addEventListener('click', () => { resumeModal.style.display = 'none'; });

// Certificate Zoom Modal Logic
const certPreviewImg = document.getElementById('cert-img-preview');
const certModal = document.getElementById('cert-modal');
const closeCertModal = document.getElementById('close-cert-modal');

certPreviewImg.addEventListener('click', () => { certModal.style.display = 'flex'; });
closeCertModal.addEventListener('click', () => { certModal.style.display = 'none'; });

// Close modals on outside click
window.addEventListener('click', (e) => {
    if (e.target === resumeModal) resumeModal.style.display = 'none';
    if (e.target === certModal) certModal.style.display = 'none';
});