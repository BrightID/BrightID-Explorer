import time
import bitu
import clustering
import json_generator


def main():
    t1 = time.time()
    clustering.main()
    # bitu.main()
    json_generator.main()
    print(f'finished in {int(time.time() - t1)} seconds\t({time.ctime()})')


if __name__ == '__main__':
    main()
