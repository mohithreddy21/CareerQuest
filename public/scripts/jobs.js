document.addEventListener("DOMContentLoaded", () => {
    // Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById("mobile-menu-btn")
    const mobileMenu = document.getElementById("mobile-menu")
  
    mobileMenuBtn.addEventListener("click", () => {
      mobileMenu.classList.toggle("active")
  
      // Toggle hamburger to X
      const spans = mobileMenuBtn.querySelectorAll("span")
      if (mobileMenu.classList.contains("active")) {
        spans[0].style.transform = "rotate(45deg) translate(5px, 5px)"
        spans[1].style.opacity = "0"
        spans[2].style.transform = "rotate(-45deg) translate(5px, -5px)"
      } else {
        spans[0].style.transform = "none"
        spans[1].style.opacity = "1"
        spans[2].style.transform = "none"
      }
    })
  
    // Toggle Filters
    const toggleFiltersBtn = document.getElementById("toggle-filters")
    const filtersContainer = document.getElementById("filters-container")
  
    toggleFiltersBtn.addEventListener("click", () => {
      const isVisible = filtersContainer.style.display !== "none"
  
      if (isVisible) {
        filtersContainer.style.display = "none"
        toggleFiltersBtn.querySelector("span").textContent = "Show Filters"
        toggleFiltersBtn.classList.remove("active")
      } else {
        filtersContainer.style.display = "grid"
        toggleFiltersBtn.querySelector("span").textContent = "Hide Filters"
        toggleFiltersBtn.classList.add("active")
      }
    })
  
    // Apply Filters
    const applyFiltersBtn = document.getElementById("apply-filters")
    const clearFiltersBtn = document.getElementById("clear-filters")
    const jobListings = document.getElementById("job-listings")
    const noResults = document.getElementById("no-results")
    const jobsCount = document.getElementById("jobs-count")
    const resetSearchBtn = document.getElementById("reset-search")
  
    applyFiltersBtn.addEventListener("click", () => {
      // Simulate filter application
      // In a real application, this would filter the jobs based on selected criteria
  
      // For demo purposes, randomly show/hide results
      const shouldShowResults = Math.random() > 0.3
  
      if (shouldShowResults) {
        jobListings.style.display = "grid"
        noResults.style.display = "none"
  
        // Update job count (random number between 1-30)
        const randomCount = Math.floor(Math.random() * 30) + 1
        jobsCount.textContent = randomCount
      } else {
        jobListings.style.display = "none"
        noResults.style.display = "block"
        jobsCount.textContent = "0"
      }
    })
  
    clearFiltersBtn.addEventListener("click", () => {
      // Reset all filters
      document.querySelectorAll("select.filter-select").forEach((select) => {
        select.selectedIndex = 0
      })
  
      document.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
        checkbox.checked = false
      })
  
      document.getElementById("job-search").value = ""
  
      // Show all results
      jobListings.style.display = "grid"
      noResults.style.display = "none"
      jobsCount.textContent = "24"
    })
  
    resetSearchBtn.addEventListener("click", () => {
      clearFiltersBtn.click()
    })
  
    // Bookmark functionality
    const bookmarkBtns = document.querySelectorAll(".bookmark-btn")
  
    bookmarkBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const svg = btn.querySelector("svg")
        const isBookmarked = svg.getAttribute("fill") === "currentColor"
  
        if (isBookmarked) {
          svg.setAttribute("fill", "none")
          btn.setAttribute("aria-label", "Bookmark job")
        } else {
          svg.setAttribute("fill", "currentColor")
          btn.setAttribute("aria-label", "Remove bookmark")
        }
      })
    })
  
    // Pagination
    const paginationNumbers = document.querySelectorAll(".pagination-number")
  
    paginationNumbers.forEach((btn) => {
      btn.addEventListener("click", () => {
        // Remove active class from all buttons
        paginationNumbers.forEach((b) => b.classList.remove("active"))
  
        // Add active class to clicked button
        btn.classList.add("active")
  
        // Scroll to top of job listings
        document.querySelector(".results-count").scrollIntoView({ behavior: "smooth" })
      })
    })
  })
  