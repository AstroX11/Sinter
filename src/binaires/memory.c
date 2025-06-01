#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <dirent.h>

typedef struct {
    long vm_size;
    long vm_rss;
    long vm_data;
    long vm_stack;
} memory_info;

int get_node_pid() {
    DIR *proc_dir;
    struct dirent *entry;
    FILE *cmdline_file;
    char path[256];
    char cmdline[1024];
    
    proc_dir = opendir("/proc");
    if (!proc_dir) return -1;
    
    while ((entry = readdir(proc_dir)) != NULL) {
        if (strspn(entry->d_name, "0123456789") == strlen(entry->d_name)) {
            snprintf(path, sizeof(path), "/proc/%s/cmdline", entry->d_name);
            cmdline_file = fopen(path, "r");
            
            if (cmdline_file) {
                if (fgets(cmdline, sizeof(cmdline), cmdline_file)) {
                    if (strstr(cmdline, "node")) {
                        fclose(cmdline_file);
                        closedir(proc_dir);
                        return atoi(entry->d_name);
                    }
                }
                fclose(cmdline_file);
            }
        }
    }
    
    closedir(proc_dir);
    return -1;
}

memory_info get_memory_usage(int pid) {
    memory_info mem = {0};
    FILE *status_file;
    char path[256];
    char line[256];
    char key[64];
    long value;
    
    snprintf(path, sizeof(path), "/proc/%d/status", pid);
    status_file = fopen(path, "r");
    
    if (!status_file) return mem;
    
    while (fgets(line, sizeof(line), status_file)) {
        if (sscanf(line, "%s %ld kB", key, &value) == 2) {
            if (strcmp(key, "VmSize:") == 0) mem.vm_size = value;
            else if (strcmp(key, "VmRSS:") == 0) mem.vm_rss = value;
            else if (strcmp(key, "VmData:") == 0) mem.vm_data = value;
            else if (strcmp(key, "VmStk:") == 0) mem.vm_stack = value;
        }
    }
    
    fclose(status_file);
    return mem;
}

void display_memory(memory_info mem) {
    printf("Memory Usage (KB):\n");
    printf("Virtual Size: %ld\n", mem.vm_size);
    printf("Physical RSS: %ld\n", mem.vm_rss);
    printf("Data Segment: %ld\n", mem.vm_data);
    printf("Stack Size: %ld\n", mem.vm_stack);
    printf("\nMemory Usage (MB):\n");
    printf("Virtual Size: %.2f\n", mem.vm_size / 1024.0);
    printf("Physical RSS: %.2f\n", mem.vm_rss / 1024.0);
}

int main() {
    int pid = get_node_pid();
    
    if (pid == -1) {
        printf("No Node.js process found\n");
        return 1;
    }
    
    printf("Found Node.js process: PID %d\n", pid);
    
    memory_info mem = get_memory_usage(pid);
    
    if (mem.vm_size == 0) {
        printf("Failed to read memory information\n");
        return 1;
    }
    
    display_memory(mem);
    
    return 0;
}