import os
import time
import utils
import bitu_updater
import json_generator


def main():
    start_time = time.time()

    # gets and restores database backup
    utils.restore_backup()

    # updates nodes' position
    print('\nUpdating positions...')
    os.system('node ./position_updater/runner.js')

    # calculates bitu score
    bitu_updater.eligible_finder.run()
    bitu_updater.score_calculator.run()

    # updates BrightID explorer json file
    json_generator.run()

    print(f'finished in {int(time.time() - start_time)} seconds\t({time.ctime()})')


if __name__ == '__main__':
    main()
