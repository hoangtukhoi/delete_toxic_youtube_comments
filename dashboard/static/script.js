document.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('fetch-btn');
    const videoIdInput = document.getElementById('video-id-input');
    const commentList = document.getElementById('comment-list');
    const statTotal = document.getElementById('stat-total');
    const statToxic = document.getElementById('stat-toxic');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    
    // Advanced search controls
    const keywordSearch = document.getElementById('keyword-search');

    let allComments = [];
    let currentFilter = 'all'; // 'all', 'toxic', 'clean'
    let searchQuery = '';
    
    let currentPage = 1;
    const pageSize = 50;
    let totalComments = 0;
    let totalPages = 1;

    const scanTypeSelect = document.getElementById('scan-type');
    const paginationControls = document.getElementById('pagination-controls');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageInfo = document.getElementById('page-info');
    const progressContainer = document.getElementById('progress-container');
    const progressMessage = document.getElementById('progress-message');
    const progressCount = document.getElementById('progress-count');
    const progressBar = document.getElementById('progress-bar');
    let scanInterval = null;

    // Start Scanning Task
    fetchBtn.addEventListener('click', async () => {
        const targetId = videoIdInput.value.trim();
        const scanType = scanTypeSelect ? scanTypeSelect.value : 'video';
        
        if (!targetId) {
            showToast('Vui lòng nhập ID!');
            return;
        }

        fetchBtn.disabled = true;
        fetchBtn.innerText = 'Đang khởi tạo...';
        progressContainer.classList.remove('hidden');
        progressMessage.innerText = 'Đang bắt đầu quét...';
        progressCount.innerText = '0';
        progressBar.style.width = '100%';
        progressBar.classList.add('pulse-animation'); // Assuming some css or just solid color
        
        commentList.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Đang chạy tác vụ chạy ngầm (Background Task). Vui lòng đợi...</p></div>';

        try {
            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: targetId, scan_type: scanType })
            });
            const data = await response.json();

            if (data.task_id) {
                pollProgress(data.task_id, targetId, scanType);
            } else {
                throw new Error(data.detail || 'Lỗi không xác định');
            }
        } catch (error) {
            console.error(error);
            showToast('Lỗi: ' + error.message);
            resetScanUI();
            commentList.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${error.message}</p></div>`;
        }
    });

    function pollProgress(taskId, targetId, scanType) {
        scanInterval = setInterval(async () => {
            try {
                const res = await fetch(`/api/scan-progress/${taskId}`);
                const data = await res.json();
                
                progressMessage.innerText = data.message;
                progressCount.innerText = `Đã quét: ${data.progress || 0} bình luận`;
                
                if (data.status === 'completed') {
                    clearInterval(scanInterval);
                    progressMessage.innerText = 'Hoàn thành! Đang tải dữ liệu...';
                    progressBar.classList.remove('pulse-animation');
                    
                    setTimeout(() => {
                        currentPage = 1;
                        fetchComments(targetId, scanType, currentPage);
                    }, 1000);
                } else if (data.status === 'error') {
                    clearInterval(scanInterval);
                    showToast('Lỗi quét: ' + data.message);
                    resetScanUI();
                }
            } catch (err) {
                console.error('Polling error', err);
            }
        }, 2000); // poll every 2 seconds
    }

    async function fetchComments(targetId, scanType, page = 1) {
        try {
            const url = `/api/comments?target_id=${targetId}&scan_type=${scanType}&page=${page}&limit=${pageSize}&filter_type=${currentFilter}&search=${encodeURIComponent(searchQuery)}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.comments) {
                allComments = data.comments;
                totalComments = data.total;
                currentPage = data.page;
                totalPages = Math.ceil(totalComments / pageSize) || 1;
                
                renderComments();
                updatePaginationUI();
                updateStats();
                showToast(`Đã lấy dữ liệu trang ${currentPage}!`);
            }
        } catch (error) {
            showToast('Lỗi tải bình luận: ' + error.message);
        } finally {
            resetScanUI();
        }
    }

    function updatePaginationUI() {
        if (!paginationControls) return;
        
        if (totalComments > 0) {
            paginationControls.classList.remove('hidden');
            paginationControls.style.display = 'flex';
        } else {
            paginationControls.classList.add('hidden');
        }
        
        pageInfo.innerText = `Trang ${currentPage} / ${totalPages}`;
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                const targetId = videoIdInput.value.trim();
                const scanType = scanTypeSelect ? scanTypeSelect.value : 'video';
                fetchComments(targetId, scanType, currentPage);
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                const targetId = videoIdInput.value.trim();
                const scanType = scanTypeSelect ? scanTypeSelect.value : 'video';
                fetchComments(targetId, scanType, currentPage);
            }
        });
    }

    function resetScanUI() {
        fetchBtn.disabled = false;
        fetchBtn.innerText = 'Quét';
        progressContainer.classList.add('hidden');
    }

    // Category filtering
    if (filterBtns) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                currentPage = 1;
                const targetId = videoIdInput.value.trim();
                const scanType = scanTypeSelect ? scanTypeSelect.value : 'video';
                if (targetId) fetchComments(targetId, scanType, currentPage);
            });
        });
    }

    // Search filter
    if (keywordSearch) {
        let timeout = null;
        keywordSearch.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                currentPage = 1;
                const targetId = videoIdInput.value.trim();
                const scanType = scanTypeSelect ? scanTypeSelect.value : 'video';
                if (targetId) fetchComments(targetId, scanType, currentPage);
            }, 500);
        });
    }

    // Bulk delete action
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', async () => {
            const visibleToxic = getVisibleComments().filter(c => c.is_toxic);
            if (visibleToxic.length === 0) return;

            if (!confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${visibleToxic.length} bình luận toxic đang hiển thị?`)) {
                return;
            }

            bulkDeleteBtn.disabled = true;
            bulkDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xóa...';

            let successCount = 0;
            for (const comment of visibleToxic) {
                const result = await performModeration(comment.id, 'delete');
                if (result) successCount++;
            }

            showToast(`Đã xóa thành công ${successCount} bình luận toxic!`);
            bulkDeleteBtn.disabled = false;
            bulkDeleteBtn.innerHTML = '<i class="fas fa-biohazard"></i> Xóa tất cả Toxic';
            
            renderComments();
            updateStats();
        });
    }

    function getVisibleComments() {
        return allComments; // Filtering is now done on the server
    }

    function renderComments() {
        commentList.innerHTML = '';
        const filtered = getVisibleComments();

        // Show/Hide bulk delete button
        const toxicInView = filtered.filter(c => c.is_toxic);
        if (bulkDeleteBtn) {
            if (toxicInView.length > 0) {
                bulkDeleteBtn.classList.remove('hidden');
            } else {
                bulkDeleteBtn.classList.add('hidden');
            }
        }

        if (filtered.length === 0) {
            commentList.innerHTML = '<div class="empty-state"><i class="fas fa-filter"></i><p>Không thấy bình luận nào khớp với bộ lọc hiện tại.</p></div>';
            return;
        }

        filtered.forEach(comment => {
            const card = document.createElement('div');
            card.className = `comment-card ${comment.is_toxic ? 'toxic-border toxic' : 'clean'}`;
            card.innerHTML = `
                <div class="comment-card-inner">
                    <div class="card-header">
                        <div class="author-box">
                            <img src="${comment.author_image || 'https://ui-avatars.com/api/?name=' + comment.author}" alt="Avatar">
                            <span class="author-name">${comment.author}</span>
                        </div>
                        <span class="prediction-badge ${comment.is_toxic ? 'toxic' : 'clean'}">
                            ${comment.is_toxic ? 'Toxic' : 'Sạch'}
                        </span>
                    </div>
                    <div class="comment-text">${comment.text}</div>
                    <div class="confidence-container">
                        <div class="confidence-label">Độ tin cậy AI: ${comment.confidence}%</div>
                        <div class="confidence-bar-container">
                            <div class="confidence-bar" style="width: ${comment.confidence}%"></div>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="action-btn keep-btn" onclick="moderate('${comment.id}', 'approve')">
                            <i class="fas fa-check"></i> Giữ lại
                        </button>
                        <button class="action-btn delete-btn" onclick="moderate('${comment.id}', 'delete')">
                            <i class="fas fa-trash"></i> Xóa vĩnh viễn
                        </button>
                    </div>
                </div>
            `;
            commentList.appendChild(card);
        });
    }

    function updateStats() {
        if (statTotal) statTotal.innerText = totalComments;
        if (statToxic) {
            // Hiển thị số toxic ở trang hiện tại
            const currentToxic = allComments.filter(c => c.is_toxic).length;
            statToxic.innerText = currentToxic;
        }
    }

    async function performModeration(commentId, action) {
        const videoId = videoIdInput.value;
        const url = action === 'approve' ? '/api/approve' : '/api/delete';
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment_id: commentId, video_id: videoId })
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                allComments = allComments.filter(c => c.id !== commentId);
                return true;
            }
        } catch (error) {
            console.error('Moderation error:', error);
        }
        return false;
    }

    window.moderate = async (commentId, action) => {
        const success = await performModeration(commentId, action);
        if (success) {
            showToast(action === 'approve' ? 'Đã giữ lại bình luận!' : 'Đã xóa bình luận!');
            renderComments();
            updateStats();
        } else {
            showToast('Lỗi khi thực hiện thao tác.');
        }
    };

    function showToast(message) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = message;
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 3000);
        }
    }

    // ==========================================
    // Tab Navigation & Analytics
    // ==========================================
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    const moderationSection = document.querySelector('.comment-section');
    const analyticsSection = document.getElementById('analytics-section');
    const topBar = document.querySelector('.top-bar');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            if (item.dataset.tab === 'analytics') {
                moderationSection.classList.add('hidden');
                topBar.classList.add('hidden');
                analyticsSection.classList.remove('hidden');
                loadAnalytics();
            } else {
                analyticsSection.classList.add('hidden');
                topBar.classList.remove('hidden');
                moderationSection.classList.remove('hidden');
            }
        });
    });

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            window.location.href = '/api/export';
        });
    }

    let pieChart, lineChart, barChart;

    async function loadAnalytics() {
        try {
            const res = await fetch('/api/analytics');
            const data = await res.json();
            renderCharts(data);
        } catch (err) {
            console.error('Failed to load analytics', err);
        }
    }

    function renderCharts(data) {
        Chart.defaults.color = '#e0e0e0';
        
        // 1. Pie Chart
        const pieCtx = document.getElementById('pieChart');
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: ['Toxic', 'Sạch'],
                datasets: [{
                    data: [data.summary.toxic, data.summary.total - data.summary.toxic],
                    backgroundColor: ['#ff4e50', '#00f260'],
                    borderWidth: 0
                }]
            }
        });

        // 2. Line Chart (Trend)
        const lineCtx = document.getElementById('lineChart');
        if (lineChart) lineChart.destroy();
        lineChart = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: data.trend.map(t => t.date),
                datasets: [
                    { label: 'Toxic', data: data.trend.map(t => t.toxic), borderColor: '#ff4e50', tension: 0.4 },
                    { label: 'Sạch', data: data.trend.map(t => t.clean), borderColor: '#00f260', tension: 0.4 }
                ]
            }
        });

        // 3. Bar Chart (Top Users)
        const barCtx = document.getElementById('barChart');
        if (barChart) barChart.destroy();
        barChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: data.top_users.map(u => u.author.substring(0, 15) + '...'),
                datasets: [{
                    label: 'Số bình luận Toxic',
                    data: data.top_users.map(u => u.toxic_count),
                    backgroundColor: '#00d2ff'
                }]
            }
        });
    }
});
