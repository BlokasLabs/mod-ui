#ifndef MOD_UTILS_PATCHSTORGE_H_INCLUDED
#define MOD_UTILS_PATCHSTORGE_H_INCLUDED

typedef struct
{
    const char *json;
} patchstorage_info_t;

// The const char* members of the info struct must be freed, if they're not nullptr
// Returns 0 on success, negative error code on failure.
int patchstorage_read_info(patchstorage_info_t *info, const char *bundleuri);
void patchstorage_info_dup(patchstorage_info_t *dst, const patchstorage_info_t *src);
void patchstorage_free_info(patchstorage_info_t *info);

#endif // MOD_UTILS_PATCHSTORGE_H_INCLUDED
