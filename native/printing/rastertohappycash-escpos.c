#include <cups/raster.h>

#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define MAX_BAND_ROWS 128
#define BOTTOM_FEED_ROWS 24

static int write_all(const void *buffer, size_t length) {
  const unsigned char *cursor = buffer;

  while (length > 0) {
    ssize_t written = write(STDOUT_FILENO, cursor, length);
    if (written < 0) {
      if (errno == EINTR) continue;
      return -1;
    }

    cursor += written;
    length -= (size_t)written;
  }

  return 0;
}

static int read_row(cups_raster_t *raster, unsigned char *row, unsigned length) {
  unsigned offset = 0;

  while (offset < length) {
    unsigned read_count = cupsRasterReadPixels(raster, row + offset, length - offset);
    if (read_count == 0) return -1;
    offset += read_count;
  }

  return 0;
}

static int row_has_ink(const unsigned char *row, size_t length) {
  for (size_t index = 0; index < length; index += 1) {
    if (row[index] != 0) return 1;
  }

  return 0;
}

static int print_page(cups_raster_t *raster, const cups_page_header2_t *header) {
  if (header->cupsBitsPerPixel != 1 || header->cupsBitsPerColor != 1) {
    fprintf(stderr, "ERROR: HappyCash ESC/POS requires a 1-bit raster.\n");
    return -1;
  }

  const size_t raster_bytes = (header->cupsWidth + 7U) / 8U;
  const size_t row_bytes = header->cupsBytesPerLine;
  const size_t page_bytes = raster_bytes * header->cupsHeight;
  unsigned char *page = calloc(page_bytes, 1);
  unsigned char *source_row = malloc(row_bytes);

  if (!page || !source_row) {
    fprintf(stderr, "ERROR: Unable to allocate receipt raster buffer.\n");
    free(page);
    free(source_row);
    return -1;
  }

  long last_ink_row = -1;
  for (unsigned y = 0; y < header->cupsHeight; y += 1) {
    if (read_row(raster, source_row, (unsigned)row_bytes) != 0) {
      fprintf(stderr, "ERROR: Incomplete CUPS raster row %u.\n", y);
      free(page);
      free(source_row);
      return -1;
    }

    unsigned char *target_row = page + ((size_t)y * raster_bytes);
    memcpy(target_row, source_row, raster_bytes);
    if (row_has_ink(target_row, raster_bytes)) last_ink_row = (long)y;
  }

  free(source_row);

  if (last_ink_row < 0) {
    free(page);
    return 0;
  }

  size_t rows_to_print = (size_t)last_ink_row + 1U + BOTTOM_FEED_ROWS;
  if (rows_to_print > header->cupsHeight) rows_to_print = header->cupsHeight;

  for (size_t start_row = 0; start_row < rows_to_print; start_row += MAX_BAND_ROWS) {
    size_t band_rows = rows_to_print - start_row;
    if (band_rows > MAX_BAND_ROWS) band_rows = MAX_BAND_ROWS;

    unsigned char command[] = {
      0x1d, 0x76, 0x30, 0x00,
      (unsigned char)(raster_bytes & 0xffU),
      (unsigned char)((raster_bytes >> 8U) & 0xffU),
      (unsigned char)(band_rows & 0xffU),
      (unsigned char)((band_rows >> 8U) & 0xffU),
    };

    if (write_all(command, sizeof(command)) != 0
        || write_all(page + (start_row * raster_bytes), band_rows * raster_bytes) != 0) {
      fprintf(stderr, "ERROR: Unable to write ESC/POS raster band.\n");
      free(page);
      return -1;
    }
  }

  fprintf(stderr, "INFO: HappyCash ESC/POS emitted %zu of %u raster rows.\n",
          rows_to_print, header->cupsHeight);
  free(page);
  return 0;
}

int main(int argc, char *argv[]) {
  if (argc < 6 || argc > 7) {
    fprintf(stderr, "ERROR: Usage: %s job-id user title copies options [file]\n", argv[0]);
    return 1;
  }

  int input_fd = STDIN_FILENO;
  if (argc == 7) {
    input_fd = open(argv[6], O_RDONLY);
    if (input_fd < 0) {
      fprintf(stderr, "ERROR: Unable to open raster input: %s\n", strerror(errno));
      return 1;
    }
  }

  cups_raster_t *raster = cupsRasterOpen(input_fd, CUPS_RASTER_READ);
  if (!raster) {
    fprintf(stderr, "ERROR: Unable to open CUPS raster stream.\n");
    if (input_fd != STDIN_FILENO) close(input_fd);
    return 1;
  }

  const unsigned char initialize[] = {0x1b, 0x40, 0x1b, 0x61, 0x00};
  if (write_all(initialize, sizeof(initialize)) != 0) {
    cupsRasterClose(raster);
    if (input_fd != STDIN_FILENO) close(input_fd);
    return 1;
  }

  cups_page_header2_t header;
  unsigned page_number = 0;
  while (cupsRasterReadHeader2(raster, &header)) {
    page_number += 1;
    fprintf(stderr, "PAGE: %u 1\n", page_number);
    fprintf(stderr, "INFO: HappyCash ESC/POS raster %ux%u, %u bytes per line.\n",
            header.cupsWidth, header.cupsHeight, header.cupsBytesPerLine);

    if (print_page(raster, &header) != 0) {
      cupsRasterClose(raster);
      if (input_fd != STDIN_FILENO) close(input_fd);
      return 1;
    }
  }

  cupsRasterClose(raster);
  if (input_fd != STDIN_FILENO) close(input_fd);

  if (page_number == 0) {
    fprintf(stderr, "ERROR: Raster stream contained no pages.\n");
    return 1;
  }

  const unsigned char finish[] = {
    0x1b, 0x64, 0x04,
    0x1d, 0x56, 0x42, 0x00,
  };
  if (write_all(finish, sizeof(finish)) != 0) return 1;

  return 0;
}
