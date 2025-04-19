document.addEventListener("DOMContentLoaded", () => {
    // Sticky Navigation
    const nav = document.getElementById("main-nav")
  
    window.addEventListener("scroll", () => {
      if (window.scrollY > 10) {
        nav.classList.remove("nav-transparent")
        nav.classList.add("nav-scrolled")
      } else {
        nav.classList.add("nav-transparent")
        nav.classList.remove("nav-scrolled")
      }
    })
  
    // Feature Carousel
    const track = document.getElementById("feature-track")
    const dots = document.querySelectorAll("#feature-dots .dot")
    const prevBtn = document.getElementById("prev-feature")
    const nextBtn = document.getElementById("next-feature")
    let currentIndex = 0
  
    function updateCarousel() {
      // Update track position
      track.style.transform = `translateX(-${currentIndex * 100}%)`
  
      // Update dots
      dots.forEach((dot, index) => {
        if (index === currentIndex) {
          dot.classList.add("active")
        } else {
          dot.classList.remove("active")
        }
      })
    }
  
    // Next button click
    nextBtn.addEventListener("click", () => {
      currentIndex = (currentIndex + 1) % dots.length
      updateCarousel()
    })
  
    // Previous button click
    prevBtn.addEventListener("click", () => {
      currentIndex = (currentIndex - 1 + dots.length) % dots.length
      updateCarousel()
    })
  
    // Dot clicks
    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        currentIndex = index
        updateCarousel()
      })
    })
  
    // Auto rotate carousel every 5 seconds
    setInterval(() => {
      currentIndex = (currentIndex + 1) % dots.length
      updateCarousel()
    }, 5000)
  
    // Initialize carousel
    updateCarousel()
  })
  