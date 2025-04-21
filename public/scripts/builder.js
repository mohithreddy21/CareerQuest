document.addEventListener('DOMContentLoaded', function() {
    // Template selection
    const templateOptions = document.querySelectorAll('.template-option');
    
    templateOptions.forEach(option => {
      option.addEventListener('click', function() {
        // Remove active class from all options
        templateOptions.forEach(opt => opt.classList.remove('active'));
        
        // Add active class to clicked option
        this.classList.add('active');
        
        // In a real app, this would change the resume template
        const templateName = this.getAttribute('data-template');
        console.log(`Selected template: ${templateName}`);
        
        // Update the preview with the selected template
        // This is a simplified version - in a real app, you would have different template styles
        document.getElementById('resumePreview').setAttribute('data-template', templateName);
      });
    });
    
    // Section navigation
    const sectionNavItems = document.querySelectorAll('.sections-nav li');
    const sectionEditors = document.querySelectorAll('.section-editor');
    
    sectionNavItems.forEach(item => {
      item.addEventListener('click', function() {
        // Remove active class from all items
        sectionNavItems.forEach(navItem => navItem.classList.remove('active'));
        
        // Add active class to clicked item
        this.classList.add('active');
        
        // Hide all section editors
        sectionEditors.forEach(editor => editor.classList.add('hidden'));
        
        // Show the selected section editor
        const sectionName = this.getAttribute('data-section');
        document.getElementById(`${sectionName}-section`).classList.remove('hidden');
      });
    });
    
    // Form input handling for real-time preview
    const formInputs = document.querySelectorAll('input, textarea');
    
    formInputs.forEach(input => {
      input.addEventListener('input', updatePreview);
    });
    
    // Initial preview update
    updatePreview();
    
    // Add section button
    const addSectionBtn = document.querySelector('.add-section-btn');
    
    if (addSectionBtn) {
      addSectionBtn.addEventListener('click', function() {
        // In a real app, this would open a modal to select additional sections
        alert('In a complete app, this would allow you to add custom sections to your resume.');
      });
    }
    
    // Add experience item button
    const addItemBtn = document.querySelector('.add-item-btn');
    
    if (addItemBtn) {
      addItemBtn.addEventListener('click', function() {
        // In a real app, this would clone the experience item template and append it
        alert('In a complete app, this would add another work experience entry.');
      });
    }
    
    // Download buttons
    const downloadPDFBtn = document.getElementById('downloadPDF');
    const downloadDOCXBtn = document.getElementById('downloadDOCX');
    
    if (downloadPDFBtn) {
      downloadPDFBtn.addEventListener('click', function() {
        // In a real app, this would generate and download a PDF
        alert('In a complete app, this would generate and download your resume as a PDF file.');
      });
    }
    
    if (downloadDOCXBtn) {
      downloadDOCXBtn.addEventListener('click', function() {
        // In a real app, this would generate and download a DOCX
        alert('In a complete app, this would generate and download your resume as a DOCX file.');
      });
    }
  });
  
  // Function to update the resume preview based on form inputs
  function updatePreview() {
    // Personal information
    const fullName = document.getElementById('fullName');
    const jobTitle = document.getElementById('jobTitle');
    const email = document.getElementById('email');
    const phone = document.getElementById('phone');
    const location = document.getElementById('location');
    
    // Update preview elements if they exist
    if (fullName && fullName.value) {
      document.getElementById('previewName').textContent = fullName.value;
    }
    
    if (jobTitle && jobTitle.value) {
      document.getElementById('previewJobTitle').textContent = jobTitle.value;
    }
    
    if (email && email.value) {
      document.getElementById('previewEmail').textContent = email.value;
    }
    
    if (phone && phone.value) {
      document.getElementById('previewPhone').textContent = phone.value;
    }
    
    if (location && location.value) {
      document.getElementById('previewLocation').textContent = location.value;
    }
    
    // Professional profile
    const profileSummary = document.getElementById('profileSummary');
    
    if (profileSummary && profileSummary.value) {
      const profileSection = document.getElementById('previewProfile');
      if (profileSection) {
        // Clear existing content except the heading
        const heading = profileSection.querySelector('h2');
        profileSection.innerHTML = '';
        profileSection.appendChild(heading);
        
        // Add the new summary
        const summaryPara = document.createElement('p');
        summaryPara.textContent = profileSummary.value;
        profileSection.appendChild(summaryPara);
      }
    }
    
    // Work experience
    const jobTitle1 = document.getElementById('jobTitle1');
    const employer1 = document.getElementById('employer1');
    const location1 = document.getElementById('location1');
    const startDate1 = document.getElementById('startDate1');
    const endDate1 = document.getElementById('endDate1');
    const currentJob1 = document.getElementById('currentJob1');
    const jobDescription1 = document.getElementById('jobDescription1');
    
    if (jobTitle1 || employer1 || location1 || startDate1 || jobDescription1) {
      const experienceSection = document.getElementById('previewExperience');
      if (experienceSection) {
        // Clear existing content except the heading
        const heading = experienceSection.querySelector('h2');
        experienceSection.innerHTML = '';
        experienceSection.appendChild(heading);
        
        // Create a new experience entry
        const entryDiv = document.createElement('div');
        entryDiv.className = 'experience-entry';
        
        // Job header with title and dates
        const headerDiv = document.createElement('div');
        headerDiv.className = 'job-header';
        
        const titleH3 = document.createElement('h3');
        titleH3.textContent = jobTitle1 && jobTitle1.value ? jobTitle1.value : 'Job Title';
        headerDiv.appendChild(titleH3);
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'job-date';
        
        let dateText = '';
        if (startDate1 && startDate1.value) {
          dateText = formatDate(startDate1.value);
          if (currentJob1 && currentJob1.checked) {
            dateText += ' - Present';
          } else if (endDate1 && endDate1.value) {
            dateText += ` - ${formatDate(endDate1.value)}`;
          }
        } else {
          dateText = 'Month Year - Present';
        }
        
        dateSpan.textContent = dateText;
        headerDiv.appendChild(dateSpan);
        entryDiv.appendChild(headerDiv);
        
        // Company and location
        const companyPara = document.createElement('p');
        companyPara.className = 'job-company';
        
        let companyText = '';
        if (employer1 && employer1.value) {
          companyText = employer1.value;
          if (location1 && location1.value) {
            companyText += `, ${location1.value}`;
          }
        } else {
          companyText = 'Company Name, Location';
        }
        
        companyPara.textContent = companyText;
        entryDiv.appendChild(companyPara);
        
        // Job description
        const descPara = document.createElement('p');
        descPara.className = 'job-description';
        descPara.textContent = jobDescription1 && jobDescription1.value 
          ? jobDescription1.value 
          : 'Your job description will appear here...';
        entryDiv.appendChild(descPara);
        
        experienceSection.appendChild(entryDiv);
      }
    }
  }
  
  // Helper function to format date from input[type="month"]
  function formatDate(dateString) {
    const date = new Date(dateString);
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();
    return `${month} ${year}`;
  }