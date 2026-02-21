import time
import statistics
import concurrent.futures
from sqlalchemy import text
from database import get_engine
from models import ConnectionConfig
from typing import List, Dict, Any

def run_benchmark(config: ConnectionConfig, sql: str, concurrency: int = 5, duration: int = 10) -> Dict[str, Any]:
    # Optimize pool size for concurrency
    engine_args = {}
    if config.type != 'sqlite':
        engine_args = {
            "pool_size": concurrency,
            "max_overflow": 0
        }
    
    engine = get_engine(config, **engine_args)
    latencies = []
    errors = 0
    total_requests = 0
    start_time = time.time()
    end_time = start_time + duration

    def worker():
        nonlocal errors, total_requests
        with engine.connect() as conn:
            while time.time() < end_time:
                req_start = time.time()
                try:
                    conn.execute(text(sql))
                    latencies.append((time.time() - req_start) * 1000)
                except:
                    errors += 1
                total_requests += 1

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(worker) for _ in range(concurrency)]
        concurrent.futures.wait(futures)

    actual_duration = max(time.time() - start_time, 0.001)
    
    result = {
        "concurrency": concurrency,
        "duration_sec": round(actual_duration, 2),
        "total_requests": total_requests,
        "successful_requests": len(latencies),
        "errors": errors,
        "throughput_rps": round(len(latencies) / actual_duration, 2),
    }

    if not latencies:
        result.update({
            "avg_latency_ms": 0, "min_latency_ms": 0, "max_latency_ms": 0, 
            "p95_latency_ms": 0, "p99_latency_ms": 0, "latency_samples": []
        })
        return result

    latencies.sort()
    result.update({
        "avg_latency_ms": round(statistics.mean(latencies), 2),
        "min_latency_ms": round(min(latencies), 2),
        "max_latency_ms": round(max(latencies), 2),
        "p95_latency_ms": round(latencies[int(len(latencies) * 0.95)], 2),
        "p99_latency_ms": round(latencies[int(len(latencies) * 0.99)], 2) if len(latencies) > 100 else round(latencies[-1], 2),
        "latency_samples": latencies[::max(1, len(latencies)//100)]
    })
    
    return result