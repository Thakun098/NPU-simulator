import React from 'react';

const ExecutionLog = ({ log }) => {
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log.length]);

  return (
    <div className="exec-log">
      <h3>
        <span className="icon">📋</span> Execution Log
      </h3>
      <div className="log-entries" ref={scrollRef}>
        {log.length === 0 && (
          <div className="log-empty">No instructions executed yet</div>
        )}
        {log.map((entry, i) => (
          <div key={i} className={`log-entry ${entry.action.includes('GEMM') ? 'log-gemm' : ''} ${entry.action.includes('ERROR') ? 'log-error' : ''}`}>
            <span className="log-cycle">C{entry.cycle}</span>
            <span className="log-action">{entry.action}</span>
            <span className="log-detail">{entry.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExecutionLog;
