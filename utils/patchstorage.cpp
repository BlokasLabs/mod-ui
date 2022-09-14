#include "patchstorage.h"

#include <cstdlib>
#include <cstdio>
#include <cstring>
#include <lilv/lilv.h>
#include <climits>
#include <errno.h>
#include <sys/stat.h>

static char* lilv_file_abspath(const char* const path)
{
    if (char* const lilvpath = lilv_file_uri_parse(path, nullptr))
    {
        char* ret = realpath(lilvpath, nullptr);
        lilv_free(lilvpath);
        return ret;
    }

    return nullptr;
}

static int patchstorage_read_all(patchstorage_info_t *info, FILE *f)
{
    int fd = fileno(f);

    struct stat stat;
    fstat(fd, &stat);

    off_t n = stat.st_size;

    char *contents = (char*)malloc(n+1);
    if (!contents)
        return -ENOMEM;

    char *p = contents;
    int c;

    while (p < contents+n)
    {
        c = fgetc(f);
        if (c == EOF)
            break;

        *p++ = c;
    }

    *p = '\0';

    info->json = contents;

    return 0;
}

int patchstorage_read_info(patchstorage_info_t *info, const char *bundleuri)
{
    if (!info)
        return -EINVAL;
    info->json = nullptr;
    if (!bundleuri)
        return -EINVAL;

    int result;
    char *bundlepath = lilv_file_abspath(bundleuri);
    char pspath[PATH_MAX+1];
    strncpy(pspath, bundlepath, PATH_MAX);
    pspath[PATH_MAX] = '\0';
    free(bundlepath);
    if (strlen(pspath) <= PATH_MAX-18)
    {
        strcat(pspath, "/patchstorage.json");
        pspath[PATH_MAX] = '\0';

        FILE *f = fopen(pspath, "rt");
        if (f)
        {
            result = patchstorage_read_all(info, f);
            fclose(f);
        }
        else
        {
            result = -EIO;
        }
    }
    else result=-ENAMETOOLONG;

    return result;
}

void patchstorage_info_dup(patchstorage_info_t *dst, const patchstorage_info_t *src)
{
    dst->json = src->json ? strdup(src->json) : nullptr;
}

void patchstorage_free_info(patchstorage_info_t *info)
{
    if (info->json) free((void*)info->json);
    memset(info, 0, sizeof(*info));
}
