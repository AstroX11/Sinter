class MemoryMonitor {
	static getProcessMemory() {
		const usage = process.memoryUsage();
		return {
			rss: Math.round((usage.rss / 1024 / 1024) * 100) / 100,
			heapTotal: Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100,
			heapUsed: Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100,
			external: Math.round((usage.external / 1024 / 1024) * 100) / 100,
			arrayBuffers: Math.round((usage.arrayBuffers / 1024 / 1024) * 100) / 100,
		};
	}

	static getSystemMemory() {
		const totalMem = require("os").totalmem();
		const freeMem = require("os").freemem();
		const usedMem = totalMem - freeMem;

		return {
			total: Math.round((totalMem / 1024 / 1024 / 1024) * 100) / 100,
			free: Math.round((freeMem / 1024 / 1024 / 1024) * 100) / 100,
			used: Math.round((usedMem / 1024 / 1024 / 1024) * 100) / 100,
			percentage: Math.round((usedMem / totalMem) * 100),
		};
	}

	static startContinuousMonitoring(intervalMs = 5000) {
		return setInterval(() => {
			const proc = this.getProcessMemory();
			const sys = this.getSystemMemory();

			console.log(`[${new Date().toISOString()}] Memory Status:`);
			console.log(
				`Process RSS: ${proc.rss}MB | Heap: ${proc.heapUsed}/${proc.heapTotal}MB`
			);
			console.log(`System: ${sys.used}GB/${sys.total}GB (${sys.percentage}%)\n`);
		}, intervalMs);
	}
}

// Native C++ Addon Approach (requires node-gyp)
// binding.gyp configuration needed:
/*
{
  "targets": [{
    "target_name": "memory_native",
    "sources": ["memory_native.cc"]
  }]
}
*/

// memory_native.cc implementation:
/*
#include <node.h>
#include <v8.h>
#include <unistd.h>
#include <sys/resource.h>

namespace memory_native {
    using v8::FunctionCallbackInfo;
    using v8::Isolate;
    using v8::Local;
    using v8::Object;
    using v8::String;
    using v8::Value;
    using v8::Number;

    void GetMemoryUsage(const FunctionCallbackInfo<Value>& args) {
        Isolate* isolate = args.GetIsolate();
        Local<Object> result = Object::New(isolate);
        
        struct rusage usage;
        getrusage(RUSAGE_SELF, &usage);
        
        result->Set(isolate->GetCurrentContext(),
            String::NewFromUtf8(isolate, "maxrss").ToLocalChecked(),
            Number::New(isolate, usage.ru_maxrss)
        );
        
        args.GetReturnValue().Set(result);
    }

    void Initialize(Local<Object> exports) {
        NODE_SET_METHOD(exports, "getMemoryUsage", GetMemoryUsage);
    }

    NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)
}
*/

class FileSystemMemoryReader {
	static readProcStatus(pid = process.pid) {
		const fs = require("fs");
		try {
			const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
			const lines = status.split("\n");
			const memory = {};

			lines.forEach(line => {
				const match = line.match(
					/^(VmSize|VmRSS|VmData|VmStk|VmExe|VmLib):\s+(\d+)\s+kB/
				);
				if (match) {
					memory[match[1].toLowerCase()] = parseInt(match[2]);
				}
			});

			return {
				vmsize: Math.round((memory.vmsize / 1024) * 100) / 100,
				vmrss: Math.round((memory.vmrss / 1024) * 100) / 100,
				vmdata: Math.round((memory.vmdata / 1024) * 100) / 100,
				vmstack: Math.round((memory.vmstk / 1024) * 100) / 100,
			};
		} catch (error) {
			return null;
		}
	}

	static readMeminfo() {
		const fs = require("fs");
		try {
			const meminfo = fs.readFileSync("/proc/meminfo", "utf8");
			const lines = meminfo.split("\n");
			const info = {};

			lines.forEach(line => {
				const match = line.match(/^(\w+):\s+(\d+)\s+kB/);
				if (match) {
					info[match[1].toLowerCase()] = parseInt(match[2]);
				}
			});

			return {
				total: Math.round((info.memtotal / 1024 / 1024) * 100) / 100,
				free: Math.round((info.memfree / 1024 / 1024) * 100) / 100,
				available: Math.round((info.memavailable / 1024 / 1024) * 100) / 100,
				buffers: Math.round((info.buffers / 1024 / 1024) * 100) / 100,
				cached: Math.round((info.cached / 1024 / 1024) * 100) / 100,
			};
		} catch (error) {
			return null;
		}
	}
}
