// STATE MANAGEMENT
let state = {
    entries: [],       // All parsed release dates and items
    filteredItems: [],  // Flattened and filtered list of release items
    activeFilter: 'all',
    searchQuery: '',
    selectedItemId: null,
    lastFetched: null,
    isFetching: false
};

// DOM ELEMENTS
const btnRefresh = document.getElementById('btn-refresh');
const btnExport = document.getElementById('btn-export');
const themeToggle = document.getElementById('theme-toggle');
const spinner = document.getElementById('spinner');
const statusBadge = document.getElementById('status-badge');
const lastUpdatedText = document.getElementById('last-updated');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const filterTagsList = document.getElementById('filter-tags-list');
const timelineContainer = document.getElementById('timeline-container');
const notesTimeline = document.getElementById('notes-timeline');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const refBadgeType = document.getElementById('ref-badge-type');
const refBadgeDate = document.getElementById('ref-badge-date');
const charProgressCircle = document.getElementById('char-progress-circle');
const charCountText = document.getElementById('char-count-text');
const btnCancelTweet = document.getElementById('btn-cancel-tweet');
const btnSubmitTweet = document.getElementById('btn-submit-tweet');
const modalCloseBtn = document.getElementById('modal-close-btn');

// Stats Elements
const statFeatures = document.getElementById('stat-features');
const statAnnouncements = document.getElementById('stat-announcements');
const statIssues = document.getElementById('stat-issues');
const statTotal = document.getElementById('stat-total');

// INITIALIZE APP
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleases(false);
    setupEventListeners();
    initProgressRing();
});

// EVENTS SETUP
function setupEventListeners() {
    // Refresh feed
    btnRefresh.addEventListener('click', () => {
        if (!state.isFetching) {
            fetchReleases(true);
        }
    });

    // Export to CSV
    btnExport.addEventListener('click', exportToCSV);

    // Toggle Color Theme
    themeToggle.addEventListener('click', toggleTheme);

    // Search input
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        
        if (state.searchQuery.length > 0) {
            searchClear.style.display = 'block';
        } else {
            searchClear.style.display = 'none';
        }
        
        filterAndRender();
    });

    // Clear search
    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        searchClear.style.display = 'none';
        searchInput.focus();
        filterAndRender();
    });

    // Filters
    filterTagsList.addEventListener('click', (e) => {
        const target = e.target.closest('.filter-tag');
        if (!target) return;
        
        // Remove active class from all tags
        document.querySelectorAll('.filter-tag').forEach(tag => {
            tag.classList.remove('active');
        });
        
        // Set active
        target.classList.add('active');
        state.activeFilter = target.dataset.type;
        filterAndRender();
    });

    // Close Modal
    modalCloseBtn.addEventListener('click', closeTweetModal);
    btnCancelTweet.addEventListener('click', closeTweetModal);
    
    // Close modal on clicking overlay
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeTweetModal();
        }
    });

    // Live tweet edit character counting
    tweetTextarea.addEventListener('input', updateCharCount);

    // Submit Tweet
    btnSubmitTweet.addEventListener('click', postToTwitter);
}

// FETCH DATA
async function fetchReleases(forceRefresh = false) {
    state.isFetching = true;
    spinner.classList.add('spinning');
    btnRefresh.disabled = true;
    
    if (forceRefresh) {
        statusBadge.textContent = 'Updating...';
        statusBadge.className = 'status-indicator live';
    }

    try {
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            state.entries = data.entries;
            state.lastFetched = new Date(data.last_fetched);
            
            // Set cache badge
            statusBadge.textContent = data.source === 'cache' ? 'Cached' : 'Synced';
            statusBadge.className = data.source === 'cache' ? 'status-indicator cached' : 'status-indicator live';
            
            updateLastFetchedTime();
            calculateStats();
            filterAndRender();
            btnExport.style.display = 'inline-flex';
        } else {
            showErrorState(data.error || 'Failed parsing feed data.');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        showErrorState(error.message || 'Network communication error.');
    } finally {
        state.isFetching = false;
        spinner.classList.remove('spinning');
        btnRefresh.disabled = false;
    }
}

// UPDATE LAST FETCHED STRING
function updateLastFetchedTime() {
    if (!state.lastFetched) return;
    
    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    
    lastUpdatedText.textContent = `Last sync: Today at ${formatTime(state.lastFetched)}`;
}

// STATS GENERATOR with animation
function calculateStats() {
    let featuresCount = 0;
    let announcementsCount = 0;
    let issuesCount = 0;
    let totalCount = 0;

    state.entries.forEach(entry => {
        entry.items.forEach(item => {
            totalCount++;
            const type = item.type.toLowerCase();
            if (type.includes('feature')) featuresCount++;
            else if (type.includes('announcement')) announcementsCount++;
            else if (type.includes('issue') || type.includes('bug') || type.includes('fix')) issuesCount++;
        });
    });

    // Count Up animation
    animateCounter(statFeatures, featuresCount);
    animateCounter(statAnnouncements, announcementsCount);
    animateCounter(statIssues, issuesCount);
    animateCounter(statTotal, totalCount);
}

function animateCounter(element, targetValue) {
    let start = 0;
    const duration = 800; // ms
    const startTime = performance.now();
    
    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out quadratic
        const easeProgress = progress * (2 - progress);
        const currentValue = Math.floor(easeProgress * targetValue);
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = targetValue;
        }
    }
    
    requestAnimationFrame(update);
}

// FILTER & RENDER ROUTINE
function filterAndRender() {
    // Flatten entries and filter items
    const allFilteredDays = [];
    
    state.entries.forEach(entry => {
        const matchingItems = entry.items.filter(item => {
            // 1. Type filter
            const type = item.type.toLowerCase();
            let matchesType = false;
            
            if (state.activeFilter === 'all') {
                matchesType = true;
            } else if (state.activeFilter === 'feature') {
                matchesType = type.includes('feature');
            } else if (state.activeFilter === 'announcement') {
                matchesType = type.includes('announcement');
            } else if (state.activeFilter === 'issue') {
                matchesType = type.includes('issue') || type.includes('bug') || type.includes('fix');
            } else if (state.activeFilter === 'other') {
                matchesType = !type.includes('feature') && !type.includes('announcement') && !type.includes('issue') && !type.includes('bug') && !type.includes('fix');
            }
            
            // 2. Search query filter
            let matchesSearch = true;
            if (state.searchQuery) {
                const textPool = `${entry.date} ${item.type} ${item.plain_text}`.toLowerCase();
                matchesSearch = textPool.includes(state.searchQuery);
            }
            
            return matchesType && matchesSearch;
        });

        if (matchingItems.length > 0) {
            allFilteredDays.push({
                date: entry.date,
                items: matchingItems
            });
        }
    });

    state.filteredItems = allFilteredDays;
    renderTimeline(allFilteredDays);
}

// RENDER TIMELINE LIST
function renderTimeline(days) {
    // Hide loader
    loadingState.style.display = 'none';
    
    if (days.length === 0) {
        notesTimeline.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';
    notesTimeline.style.display = 'block';
    notesTimeline.innerHTML = '';
    
    days.forEach(day => {
        const dayBlock = document.createElement('div');
        dayBlock.className = 'timeline-day-block';
        
        // Create sticky date header
        const dateHeader = document.createElement('div');
        dateHeader.className = 'timeline-date-header';
        
        const dot = document.createElement('div');
        dot.className = 'timeline-dot';
        
        const dateText = document.createElement('span');
        dateText.className = 'timeline-date-text';
        dateText.textContent = day.date;
        
        dateHeader.appendChild(dot);
        dateHeader.appendChild(dateText);
        dayBlock.appendChild(dateHeader);
        
        // Render cards
        day.items.forEach(item => {
            const card = document.createElement('div');
            
            // Set type class
            const type = item.type.toLowerCase();
            let cardTypeClass = 'type-other';
            let badgeClass = 'other';
            
            if (type.includes('feature')) {
                cardTypeClass = 'type-feature';
                badgeClass = 'feature';
            } else if (type.includes('announcement')) {
                cardTypeClass = 'type-announcement';
                badgeClass = 'announcement';
            } else if (type.includes('issue') || type.includes('bug') || type.includes('fix')) {
                cardTypeClass = 'type-issue';
                badgeClass = 'issue';
            }
            
            card.className = `update-card ${cardTypeClass}`;
            card.dataset.id = item.id;
            
            if (state.selectedItemId === item.id) {
                card.classList.add('selected');
            }
            
            // Click to select
            card.addEventListener('click', (e) => {
                // Prevent trigger if they click the Tweet button specifically
                if (e.target.closest('.card-action-btn')) return;
                
                selectCard(item.id);
            });
            
            // Build Card Header
            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header';
            
            const badge = document.createElement('span');
            badge.className = `type-badge ${badgeClass}`;
            badge.textContent = item.type;
            
            const cardActions = document.createElement('div');
            cardActions.className = 'card-actions';
            
            // Copy to Clipboard Action
            const btnCopy = document.createElement('button');
            btnCopy.className = 'card-action-btn copy-btn';
            btnCopy.title = 'Copy text to clipboard';
            btnCopy.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
            `;
            btnCopy.addEventListener('click', (e) => {
                e.stopPropagation();
                selectCard(item.id);
                navigator.clipboard.writeText(item.plain_text).then(() => {
                    btnCopy.innerHTML = `
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--color-feature)" stroke-width="2.5" fill="none">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    `;
                    btnCopy.title = 'Copied!';
                    setTimeout(() => {
                        btnCopy.innerHTML = `
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                        `;
                        btnCopy.title = 'Copy text to clipboard';
                    }, 2000);
                }).catch(err => console.error('Failed to copy:', err));
            });
            cardActions.appendChild(btnCopy);
            
            const btnTweet = document.createElement('button');
            btnTweet.className = 'card-action-btn tweet-btn';
            btnTweet.title = 'Tweet about this update';
            btnTweet.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
            `;
            
            // Attach Tweet Compose action
            btnTweet.addEventListener('click', (e) => {
                e.stopPropagation();
                selectCard(item.id);
                openTweetComposer(item, day.date);
            });
            
            cardActions.appendChild(btnTweet);
            cardHeader.appendChild(badge);
            cardHeader.appendChild(cardActions);
            card.appendChild(cardHeader);
            
            // Build Card Body
            const cardBody = document.createElement('div');
            cardBody.className = 'card-body';
            cardBody.innerHTML = item.content;
            
            card.appendChild(cardBody);
            dayBlock.appendChild(card);
        });
        
        notesTimeline.appendChild(dayBlock);
    });
}

// SELECT CARD ROUTINE
function selectCard(itemId) {
    state.selectedItemId = itemId;
    
    // Update active classes on cards
    document.querySelectorAll('.update-card').forEach(card => {
        if (card.dataset.id === itemId) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
}

// ERROR STATE
function showErrorState(message) {
    loadingState.style.display = 'none';
    notesTimeline.style.display = 'none';
    emptyState.style.display = 'flex';
    emptyState.querySelector('h3').textContent = 'Sync failed';
    emptyState.querySelector('p').textContent = message;
    
    statusBadge.textContent = 'Failed';
    statusBadge.className = 'status-indicator issue';
}

// TWEET PROGRESS BAR MATH
let circumference;

function initProgressRing() {
    const radius = charProgressCircle.r.baseVal.value;
    circumference = radius * 2 * Math.PI;
    charProgressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    charProgressCircle.style.strokeDashoffset = circumference;
}

function updateProgressRing(typedLength) {
    const limit = 280;
    const remaining = limit - typedLength;
    
    // Set text display
    charCountText.textContent = remaining;
    
    // Calculate percentage
    const percent = Math.min((typedLength / limit) * 100, 100);
    const offset = circumference - (percent / 100) * circumference;
    charProgressCircle.style.strokeDashoffset = offset;
    
    // Change coloring states
    if (remaining < 0) {
        charProgressCircle.style.stroke = 'var(--color-issue)';
        charCountText.classList.add('warning');
        btnSubmitTweet.disabled = true;
    } else if (remaining <= 30) {
        charProgressCircle.style.stroke = '#eab308'; // Warning yellow
        charCountText.classList.remove('warning');
        btnSubmitTweet.disabled = false;
    } else {
        charProgressCircle.style.stroke = 'var(--color-primary)';
        charCountText.classList.remove('warning');
        btnSubmitTweet.disabled = false;
    }
}

// OPEN TWEET DIALOG
function openTweetComposer(item, date) {
    refBadgeType.textContent = item.type;
    refBadgeDate.textContent = date;
    
    // Format initial tweet
    const tweetText = draftTweetText(item, date);
    tweetTextarea.value = tweetText;
    
    // Set preview types for styles
    const type = item.type.toLowerCase();
    refBadgeType.className = 'ref-badge';
    if (type.includes('feature')) refBadgeType.classList.add('feature');
    else if (type.includes('announcement')) refBadgeType.classList.add('announcement');
    else if (type.includes('issue') || type.includes('bug') || type.includes('fix')) refBadgeType.classList.add('issue');
    else refBadgeType.classList.add('other');
    
    // Update sizing & chars
    tweetModal.style.display = 'flex';
    updateCharCount();
    
    // Focus textarea
    setTimeout(() => {
        tweetTextarea.focus();
    }, 100);
}

function closeTweetModal() {
    tweetModal.style.display = 'none';
}

function updateCharCount() {
    updateProgressRing(tweetTextarea.value.length);
}

// COMPOSE TWEET FORMATTER
function draftTweetText(item, date) {
    const hashtags = "\n\n#BigQuery #GoogleCloud #DataEngineering";
    const readMore = `\n\nDetails: ${item.link}`;
    const header = `BigQuery Update (${date}) | ${item.type}\n`;
    
    // Max characters available for description
    const metaLength = header.length + readMore.length + hashtags.length;
    const maxDescLength = 280 - metaLength;
    
    let description = item.plain_text;
    if (description.length > maxDescLength) {
        description = description.substring(0, maxDescLength - 3) + '...';
    }
    
    return `${header}${description}${readMore}${hashtags}`;
}

// POST EVENT TO TWITTER INTENT
function postToTwitter() {
    const text = tweetTextarea.value;
    if (text.length > 280) return;
    
    const encodedText = encodeURIComponent(text);
    const twitterUrl = `https://x.com/intent/tweet?text=${encodedText}`;
    
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    closeTweetModal();
}

// EXPORT FILTERED RELEASES TO CSV
function exportToCSV() {
    if (!state.filteredItems || state.filteredItems.length === 0) {
        alert("No items available to export.");
        return;
    }
    
    // CSV Header row
    let csvContent = '"Date","Type","Description","Link"\n';
    
    // Loop through days and items
    state.filteredItems.forEach(day => {
        day.items.forEach(item => {
            // Escape double quotes inside values by doubling them
            const cleanDesc = item.plain_text.replace(/"/g, '""');
            const cleanType = item.type.replace(/"/g, '""');
            const cleanDate = day.date.replace(/"/g, '""');
            const cleanLink = item.link.replace(/"/g, '""');
            
            csvContent += `"${cleanDate}","${cleanType}","${cleanDesc}","${cleanLink}"\n`;
        });
    });
    
    // Download trigger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    link.setAttribute("href", url);
    link.setAttribute("download", `bigquery_release_notes_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// INITIALIZE COLOR THEME PREFERENCE
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    
    const iconMoon = themeToggle.querySelector('.icon-moon');
    const iconSun = themeToggle.querySelector('.icon-sun');
    
    if (savedTheme === 'light' || (!savedTheme && systemPrefersLight)) {
        document.body.classList.add('light-theme');
        iconMoon.style.display = 'none';
        iconSun.style.display = 'block';
    } else {
        document.body.classList.remove('light-theme');
        iconMoon.style.display = 'block';
        iconSun.style.display = 'none';
    }
}

// TOGGLE THEME ROUTINE
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    const iconMoon = themeToggle.querySelector('.icon-moon');
    const iconSun = themeToggle.querySelector('.icon-sun');
    
    if (isLight) {
        iconMoon.style.display = 'none';
        iconSun.style.display = 'block';
    } else {
        iconMoon.style.display = 'block';
        iconSun.style.display = 'none';
    }
}
