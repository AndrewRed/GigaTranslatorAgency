const form = document.getElementById('translateForm');
const sourceTextInput = document.getElementById('sourceText');
const targetLangInput = document.getElementById('targetLang');
const statusBlock = document.getElementById('status');
const resultBlock = document.getElementById('result');

let pollTimer = null;
let eventSource = null;

function clearWatchers() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

async function fetchStatus(jobId) {
  const response = await fetch(`/api/jobs/${jobId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch status');
  }
  return response.json();
}

async function tryLoadResult(jobId) {
  const response = await fetch(`/api/jobs/${jobId}/result`);
  if (!response.ok) {
    return;
  }

  const body = await response.json();
  resultBlock.textContent = body.result;
}

function renderStatus(job) {
  statusBlock.textContent = `Status: ${job.status}. Progress: ${job.completed_chunks}/${job.total_chunks}. Failed chunks: ${job.failed_chunks}`;
}

async function handleStatusUpdate(jobId) {
  const job = await fetchStatus(jobId);
  renderStatus(job);

  if (job.status === 'done') {
    clearWatchers();
    await tryLoadResult(jobId);
  }

  if (job.status === 'failed') {
    clearWatchers();
  }
}

function startPolling(jobId) {
  pollTimer = setInterval(() => {
    handleStatusUpdate(jobId).catch((error) => {
      statusBlock.textContent = error.message;
      clearWatchers();
    });
  }, 1500);
}

function startSse(jobId) {
  eventSource = new EventSource(`/api/jobs/${jobId}/events`);

  eventSource.onmessage = () => {
    handleStatusUpdate(jobId).catch((error) => {
      statusBlock.textContent = error.message;
    });
  };

  eventSource.onerror = () => {
    if (!pollTimer) {
      startPolling(jobId);
    }
  };
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearWatchers();
  resultBlock.textContent = '';
  statusBlock.textContent = 'Creating translation job...';

  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: sourceTextInput.value,
      targetLang: targetLangInput.value,
    }),
  });

  if (!response.ok) {
    statusBlock.textContent = 'Failed to create job';
    return;
  }

  const body = await response.json();
  await handleStatusUpdate(body.id);
  startSse(body.id);
  startPolling(body.id);
});
