/**
 * UI Manager for PDF Editor
 * Handles all UI interactions, modal management, and user interface updates
 */
class UIManager {
    constructor(pdfHandler = null, storageManager = null) {
        this.currentView = 'upload';
        this.currentPDFId = null;
        this.modals = {};
        this.eventListenersAttached = false;
        this.pdfHandler = pdfHandler;
        this.storageManager = storageManager;
        this.initialize();
    }

    /**
     * Initialize UI manager
     */
    async initialize() {
        this.setupEventListeners();
        this.setupModals();
        
        // Check if there are existing PDFs to determine initial view
        await this.checkAndSetInitialView();
    }

    /**
     * Check storage and set appropriate initial view
     */
    async checkAndSetInitialView() {
        try {
            const storage = this.storageManager || new StorageManager();
            const pdfs = await storage.getAllPDFMetadata();
            
            if (pdfs.length > 0) {
                // Has PDFs - show management view and update list
                this.showPDFManagement();
                await this.updatePDFList();
            } else {
                // No PDFs - show upload view
                this.showUploadSection();
            }
        } catch (error) {
            console.error('Error checking initial view:', error);
            // Default to upload view on error
            this.showUploadSection();
        }
    }

    /**
     * Setup event listeners for UI elements
     */
    setupEventListeners() {
        // Prevent duplicate event listeners
        if (this.eventListenersAttached) {
            console.log('⚠️ UI event listeners already attached, skipping...');
            return;
        }
        // File upload
        const uploadBtn = document.getElementById('upload-btn');
        const fileInput = document.getElementById('pdf-file-input');
        const addMoreBtn = document.getElementById('add-more-btn');

        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => fileInput.click());
        }

        if (addMoreBtn) {
            addMoreBtn.addEventListener('click', () => fileInput.click());
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // PDF management
        const clearAllBtn = document.getElementById('clear-all-btn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => this.handleClearAll());
        }

        // PDF editor controls
        const backBtn = document.getElementById('back-to-list-btn');
        const downloadBtn = document.getElementById('download-btn');
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const prevPageBtn = document.getElementById('prev-page-btn');
        const nextPageBtn = document.getElementById('next-page-btn');

        if (backBtn) {
            backBtn.addEventListener('click', () => this.showPDFManagement());
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.handleDownload());
        }

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.handleZoomIn());
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.handleZoomOut());
        }

        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => this.handlePrevPage());
        }

        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => this.handleNextPage());
        }

        // Modal buttons
        const aboutBtn = document.getElementById('about-btn');
        const helpBtn = document.getElementById('help-btn');

        if (aboutBtn) {
            aboutBtn.addEventListener('click', () => this.showModal('about'));
        }

        if (helpBtn) {
            helpBtn.addEventListener('click', () => this.showModal('help'));
        }

        // Clear all fields button
        const clearAllFieldsBtn = document.getElementById('clear-all-fields-btn');
        if (clearAllFieldsBtn) {
            clearAllFieldsBtn.addEventListener('click', () => this.handleClearAllFields());
        }

        // Custom events
        window.addEventListener('fieldValueChanged', (e) => {
            this.handleFieldValueChanged(e.detail);
        });

        // Mark event listeners as attached
        this.eventListenersAttached = true;
        console.log('✅ UI event listeners attached');
    }

    /**
     * Setup modal functionality
     */
    setupModals() {
        const modalIds = ['about-modal', 'help-modal'];
        
        modalIds.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                this.modals[modalId] = modal;
                
                // Close button
                const closeBtn = modal.querySelector('.close-btn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => this.hideModal(modalId));
                }
                
                // Click outside to close
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.hideModal(modalId);
                    }
                });
            }
        });

        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllModals();
            }
        });
    }

    /**
     * Handle file upload
     * @param {Event} event - File input change event
     */
    async handleFileUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        this.showLoadingOverlay('Processing PDF files...');

        try {
            const storage = this.storageManager || new StorageManager();
            const pdfHandler = this.pdfHandler || new PDFHandler();
            let successCount = 0;
            let errorCount = 0;

            for (const file of files) {
                try {
                    if (file.type !== 'application/pdf') {
                        throw new Error('Only PDF files are supported');
                    }

                    // Read file as base64
                    const base64Data = await this.fileToBase64(file);
                    
                    // Load PDF to extract metadata
                    const pdfData = await pdfHandler.loadPDFFromFile(file);
                    
                    // Create PDF object for storage
                    const pdfObject = {
                        id: storage.generateId(),
                        name: file.name,
                        data: base64Data,
                        uploadDate: new Date().toISOString(),
                        metadata: {
                            size: file.size,
                            type: file.type,
                            pages: pdfData.totalPages,
                            formFields: pdfData.formFields.length
                        }
                    };

                    // Save to storage
                    await storage.savePDF(pdfObject);
                    successCount++;
                } catch (error) {
                    console.error('Error processing file:', file.name, error);
                    errorCount++;
                    
                    // Show error message
                    this.showNotification(`Failed to process "${file.name}": ${error.message}`, 'error');
                }
            }

            // Clear file input
            event.target.value = '';

            // Show results
            if (successCount > 0) {
                this.showNotification(`Successfully uploaded ${successCount} PDF(s)`, 'success');
                this.showPDFManagement();
                await this.updatePDFList();
                await this.updateStorageUsage();
            }

            if (errorCount > 0) {
                this.showNotification(`Failed to upload ${errorCount} file(s)`, 'error');
            }

        } catch (error) {
            console.error('Error uploading files:', error);
            this.showNotification('Failed to upload files: ' + error.message, 'error');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    /**
     * Convert file to base64
     * @param {File} file - File to convert
     * @returns {Promise<string>} Base64 string
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Handle clear all PDFs
     */
    async handleClearAll() {
        if (!confirm('Are you sure you want to delete all PDF files? This cannot be undone.')) {
            return;
        }

        try {
            const storage = this.storageManager || new StorageManager();
            await storage.clearAllPDFs();
            this.showNotification('All PDFs cleared successfully', 'success');
            this.showUploadSection();
        } catch (error) {
            console.error('Error clearing PDFs:', error);
            this.showNotification('Failed to clear PDFs: ' + error.message, 'error');
        }
    }

    /**
     * Handle PDF download
     */
    async handleDownload() {
        if (!this.currentPDFId) return;

        this.showLoadingOverlay('Generating PDF...');

        try {
            const storage = this.storageManager || new StorageManager();
            const pdfData = await storage.getPDF(this.currentPDFId);
            
            if (!pdfData) {
                throw new Error('PDF not found');
            }

            // Use the existing PDFHandler instance that has the form field values
            if (!window.pdfHandler) {
                throw new Error('PDF handler not initialized');
            }
            
            // Generate filled PDF using the current PDFHandler instance
            const filledPdfBytes = await window.pdfHandler.generateFilledPDF();
            
            // Download the PDF
            const blob = new Blob([filledPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `filled_${pdfData.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showNotification('PDF downloaded successfully', 'success');
        } catch (error) {
            console.error('Error downloading PDF:', error);
            this.showNotification('Failed to download PDF: ' + error.message, 'error');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    /**
     * Handle zoom in
     */
    handleZoomIn() {
        window.pdfHandler?.setZoom(window.pdfHandler.scale + 0.25);
        this.updateZoomDisplay();
    }

    /**
     * Handle zoom out
     */
    handleZoomOut() {
        window.pdfHandler?.setZoom(window.pdfHandler.scale - 0.25);
        this.updateZoomDisplay();
    }

    /**
     * Handle previous page
     */
    handlePrevPage() {
        window.pdfHandler?.previousPage();
        this.updatePageDisplay();
    }

    /**
     * Handle next page
     */
    handleNextPage() {
        window.pdfHandler?.nextPage();
        this.updatePageDisplay();
    }

    /**
     * Handle form field value changes
     * @param {Object} detail - Field change details
     */
    handleFieldValueChanged(detail) {
        // Update the PDF overlay input
        const overlayInput = document.querySelector(`#form-overlay [data-field-id="${detail.fieldId}"]`);
        if (overlayInput) {
            if (overlayInput.type === 'checkbox') {
                overlayInput.checked = detail.value === 'Yes' || detail.value === true;
            } else if (overlayInput.tagName === 'SELECT') {
                overlayInput.value = detail.value;
            } else {
                // For text inputs and textareas, only update if the value is different
                // and the field is not currently focused to avoid interrupting typing
                if (overlayInput.value !== detail.value && document.activeElement !== overlayInput) {
                    overlayInput.value = detail.value;
                }
            }
            
            // Update the filled state of the overlay
            const overlay = overlayInput.closest('.form-field-overlay');
            if (overlay) {
                if (detail.value && detail.value.toString().trim() !== '') {
                    overlay.classList.add('filled');
                } else {
                    overlay.classList.remove('filled');
                }
            }
        }
    }

    /**
     * Show upload section
     */
    showUploadSection() {
        this.hideAllSections();
        this.hideLoadingOverlay(); // Ensure loading overlay is hidden
        this.showElement('upload-section');
        this.currentView = 'upload';
    }

    /**
     * Show PDF management section
     */
    async showPDFManagement() {
        this.hideAllSections();
        this.hideLoadingOverlay(); // Ensure loading overlay is hidden
        this.showElement('pdf-management');
        this.currentView = 'management';
        await this.updatePDFList();
    }

    /**
     * Show PDF editor section
     * @param {string} pdfId - PDF ID to edit
     */
    async showPDFEditor(pdfId) {
        this.hideAllSections();
        this.showElement('pdf-editor');
        this.currentView = 'editor';
        this.currentPDFId = pdfId;
        await this.loadPDFInEditor(pdfId);
    }

    /**
     * Load PDF in editor
     * @param {string} pdfId - PDF ID
     */
    async loadPDFInEditor(pdfId) {
        this.showLoadingOverlay('Loading PDF...');

        try {
            const storage = this.storageManager || new StorageManager();
            const pdfData = await storage.getPDF(pdfId);
            
            if (!pdfData) {
                throw new Error('PDF not found');
            }

            // Update PDF name
            const nameElement = document.getElementById('current-pdf-name');
            if (nameElement) {
                nameElement.textContent = pdfData.name;
            }

            // Load PDF
            if (!window.pdfHandler) {
                window.pdfHandler = this.pdfHandler || new PDFHandler();
            }

            // Set the current PDF ID for form field persistence
            window.pdfHandler.currentPDFId = pdfId;

            await window.pdfHandler.loadPDFFromBase64(pdfData.data);
            await window.pdfHandler.renderPage(1);

            // Update controls
            this.updatePageDisplay();
            this.updateZoomDisplay();
            
            // Load saved form field values after everything is ready
            // Use nextTick to ensure DOM is fully updated
            setTimeout(async () => {
                await window.pdfHandler.loadFieldValuesFromStorage();
            }, 50);

        } catch (error) {
            console.error('Error loading PDF in editor:', error);
            this.showNotification('Failed to load PDF: ' + error.message, 'error');
            this.showPDFManagement();
        } finally {
            this.hideLoadingOverlay();
        }
    }

    /**
     * Update PDF list
     */
    async updatePDFList() {
        const listContainer = document.getElementById('pdf-list');
        if (!listContainer) return;

        try {
            const storage = this.storageManager || new StorageManager();
            const pdfs = await storage.getAllPDFMetadata(); // Use metadata-only method for performance

            if (pdfs.length === 0) {
                listContainer.innerHTML = '<p class="text-center">No PDF files uploaded yet.</p>';
                return;
            }

            // Debug: log what we're getting
            console.log('📋 PDFs array:', pdfs);
            
            // Filter and create list items, logging any issues
            const listItems = pdfs
                .filter(pdf => {
                    if (!pdf || !pdf.id) {
                        console.warn('⚠️ Skipping invalid PDF:', pdf);
                        return false;
                    }
                    return true;
                })
                .map(pdf => this.createPDFListItem(pdf));
            
            listContainer.innerHTML = listItems.join('');
            
            // Update storage usage indicator
            await this.updateStorageUsage();
        } catch (error) {
            console.error('Error updating PDF list:', error);
            listContainer.innerHTML = '<p class="text-center">Error loading PDFs.</p>';
        }
    }

    /**
     * Create PDF list item HTML
     * @param {Object} pdf - PDF data
     * @returns {string} HTML string
     */
    createPDFListItem(pdf) {
        try {
            if (!pdf || typeof pdf !== 'object') {
                console.warn('⚠️ createPDFListItem received invalid input:', pdf);
                return '';
            }
            
            // Ensure all required properties exist with fallbacks
            const safeId = pdf.id || 'unknown_' + Date.now();
            const safeName = pdf.name || 'Untitled PDF';
            const safeUploadDate = pdf.uploadDate || Date.now();
            const safeSize = pdf.size || 0;
            const safeMetadata = pdf.metadata || {};
            
            const uploadDate = new Date(safeUploadDate).toLocaleDateString();
            const storage = this.storageManager || new StorageManager();
            const fileSize = storage.formatBytes(safeSize);
            const pages = safeMetadata.pages || 'Unknown';
            const formFields = safeMetadata.formFields || 0;
        
            return `
                <div class="pdf-item" data-pdf-id="${safeId}">
                    <div class="pdf-item-header">
                        <div class="pdf-item-title">${safeName}</div>
                        <div class="pdf-item-actions">
                            <button class="pdf-item-action edit" onclick="uiManager.editPDF('${safeId}')">Edit</button>
                            <button class="pdf-item-action delete" onclick="uiManager.deletePDF('${safeId}')">Delete</button>
                        </div>
                    </div>
                    <div class="pdf-item-info">
                        <div class="pdf-item-size">${fileSize} • ${pages} pages</div>
                        <div class="pdf-item-date">Uploaded: ${uploadDate}</div>
                        <div class="pdf-item-fields">${formFields} form fields</div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('❌ Error creating PDF list item:', error, 'PDF object:', pdf);
            return '';
        }
    }

    /**
     * Edit PDF
     * @param {string} pdfId - PDF ID
     */
    async editPDF(pdfId) {
        await this.showPDFEditor(pdfId);
    }

    /**
     * Delete PDF
     * @param {string} pdfId - PDF ID
     */
    async deletePDF(pdfId) {
        const storage = this.storageManager || new StorageManager();
        const pdf = await storage.getPDF(pdfId);
        
        if (!pdf) return;

        if (!confirm(`Are you sure you want to delete "${pdf.name}"? This cannot be undone.`)) {
            return;
        }

        try {
            await storage.deletePDF(pdfId);
            this.showNotification('PDF deleted successfully', 'success');
            await this.updatePDFList();
        } catch (error) {
            console.error('Error deleting PDF:', error);
            this.showNotification('Failed to delete PDF: ' + error.message, 'error');
        }
    }

    /**
     * Update page display
     */
    updatePageDisplay() {
        const pageInfo = document.getElementById('page-info');
        if (pageInfo && window.pdfHandler) {
            const info = window.pdfHandler.getPageInfo();
            pageInfo.textContent = `Page ${info.currentPage} of ${info.totalPages}`;
        }
    }

    /**
     * Update zoom display
     */
    updateZoomDisplay() {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel && window.pdfHandler) {
            const info = window.pdfHandler.getPageInfo();
            zoomLevel.textContent = `${Math.round(info.scale * 100)}%`;
        }
    }

    /**
     * Show modal
     * @param {string} modalType - Modal type (about, help)
     */
    showModal(modalType) {
        const modalId = modalType + '-modal';
        const modal = this.modals[modalId];
        if (modal) {
            modal.classList.add('active');
        }
    }

    /**
     * Hide modal
     * @param {string} modalId - Modal ID
     */
    hideModal(modalId) {
        const modal = this.modals[modalId];
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Hide all modals
     */
    hideAllModals() {
        Object.values(this.modals).forEach(modal => {
            modal.classList.remove('active');
        });
    }

    /**
     * Show loading overlay
     * @param {string} message - Loading message
     */
    showLoadingOverlay(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.querySelector('p').textContent = message;
            overlay.classList.remove('hidden');
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, info)
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            color: white;
            font-weight: 500;
            z-index: 1100;
            max-width: 400px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;

        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#10b981';
                break;
            case 'error':
                notification.style.backgroundColor = '#ef4444';
                break;
            default:
                notification.style.backgroundColor = '#3b82f6';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    /**
     * Hide all sections
     */
    hideAllSections() {
        const sections = ['upload-section', 'pdf-management', 'pdf-editor'];
        sections.forEach(id => this.hideElement(id));
    }

    /**
     * Show element
     * @param {string} id - Element ID
     */
    showElement(id) {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = id === 'pdf-editor' ? 'flex' : 'block';
        }
    }

    /**
     * Handle clear all fields button
     */
    async handleClearAllFields() {
        if (!window.pdfHandler || !window.pdfHandler.currentPDFId) {
            this.showNotification('No PDF loaded', 'error');
            return;
        }

        const confirmed = await this.showConfirmationDialog(
            'Clear All Fields',
            'Are you sure you want to clear all form field values? This action cannot be undone.'
        );

        if (!confirmed) {
            return;
        }

        try {
            await window.pdfHandler.clearAllFormFields();
            this.showNotification('All form field values cleared', 'success');
        } catch (error) {
            console.error('Error clearing form fields:', error);
            this.showNotification('Failed to clear form fields: ' + error.message, 'error');
        }
    }

    /**
     * Show confirmation dialog
     * @param {string} title - Dialog title
     * @param {string} message - Dialog message
     * @returns {Promise<boolean>} User's choice
     */
    showConfirmationDialog(title, message) {
        return new Promise((resolve) => {
            const confirmed = window.confirm(`${title}\n\n${message}`);
            resolve(confirmed);
        });
    }

    /**
     * Update storage usage indicator
     */
    async updateStorageUsage() {
        const storageText = document.getElementById('storage-text');
        const storageFill = document.getElementById('storage-fill');
        
        if (!storageText || !storageFill) return;
        
        try {
            const storage = this.storageManager || new StorageManager();
            const storageInfo = await storage.getStorageInfo();
            
            storageText.textContent = `${storageInfo.formattedSize} used (${storageInfo.totalFiles} files)`;
            storageFill.style.width = '0%';
            storageFill.classList.remove('warning', 'danger');
            
        } catch (error) {
            console.error('Error updating storage usage:', error);
            storageText.textContent = 'Error loading storage info';
        }
    }

    /**
     * Show upload section and hide others
     */
    showUploadSection() {
        this.currentView = 'upload';
        const uploadSection = document.getElementById('upload-section');
        const managementSection = document.getElementById('pdf-management');
        const editorSection = document.getElementById('pdf-editor');
        
        if (uploadSection) uploadSection.style.display = 'block';
        if (managementSection) managementSection.style.display = 'none';
        if (editorSection) editorSection.style.display = 'none';
    }

    /**
     * Show PDF management section and hide others
     */
    showPDFManagement() {
        this.currentView = 'management';
        const uploadSection = document.getElementById('upload-section');
        const managementSection = document.getElementById('pdf-management');
        const editorSection = document.getElementById('pdf-editor');
        
        if (uploadSection) uploadSection.style.display = 'none';
        if (managementSection) managementSection.style.display = 'block';
        if (editorSection) editorSection.style.display = 'none';
    }

    /**
     * Hide element
     * @param {string} id - Element ID
     */
    hideElement(id) {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
        }
    }
}

// Export for use in other modules
window.UIManager = UIManager;
