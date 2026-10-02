"""Unit tests for the forest-loss aggregation. Run: python3 -m unittest discover scripts/forest-loss"""

import unittest

import numpy as np

from forest_loss import CellLoss, aggregate, cell_wkt, grid_vertices, pg_connection


class AggregateTest(unittest.TestCase):
    def test_share_of_valid_pixels_lost_per_year(self):
        loss = np.zeros((4, 4), dtype=np.uint8)
        loss[0, 0] = 5  # 2005, top-left cell
        loss[0, 1] = 5
        loss[1, 0] = 19  # 2019
        loss[3, 3] = 19  # bottom-right cell
        valid = np.ones((4, 4), dtype=bool)
        self.assertEqual(
            aggregate(loss, valid, cell_px=2),
            [CellLoss(0, 0, 2005, 50.0), CellLoss(0, 0, 2019, 25.0), CellLoss(1, 1, 2019, 25.0)],
        )

    def test_water_and_outside_pixels_are_left_out_of_the_share(self):
        loss = np.zeros((2, 2), dtype=np.uint8)
        loss[0, 0] = 10
        valid = np.array([[True, True], [False, False]])  # half the cell is lake
        self.assertEqual(aggregate(loss, valid, cell_px=2), [CellLoss(0, 0, 2010, 50.0)])

    def test_loss_on_invalid_pixels_is_ignored(self):
        loss = np.full((2, 2), 7, dtype=np.uint8)
        valid = np.array([[True, False], [False, False]])
        self.assertEqual(aggregate(loss, valid, cell_px=2, min_coverage=0.25), [CellLoss(0, 0, 2007, 100.0)])

    def test_cells_mostly_outside_the_area_are_skipped(self):
        loss = np.full((10, 10), 3, dtype=np.uint8)
        valid = np.zeros((10, 10), dtype=bool)
        valid[0, 0] = True  # 1% of the cell
        self.assertEqual(aggregate(loss, valid, cell_px=10), [])

    def test_partial_cells_at_the_edge_are_dropped(self):
        loss = np.full((3, 5), 1, dtype=np.uint8)
        self.assertEqual(len(aggregate(loss, np.ones((3, 5), dtype=bool), cell_px=2)), 2)


class GridTest(unittest.TestCase):
    def test_neighbouring_cells_share_exact_corners(self):
        vertices = grid_vertices(500000, 50000, rows=2, cols=2, cell_m=1000)
        left, right = cell_wkt(vertices, 0, 0), cell_wkt(vertices, 0, 1)
        left_ring = left[len("POLYGON((") : -2].split(",")
        right_ring = right[len("POLYGON((") : -2].split(",")
        self.assertIn(left_ring[1], right_ring)  # top-right of left == top-left of right
        self.assertIn(left_ring[2], right_ring)
        # Central meridian of zone 36N is 33°E; 50 km north is about 0.45°N
        lon, lat = vertices[0, 0]
        self.assertAlmostEqual(lon, 33.0, places=3)
        self.assertAlmostEqual(lat, 0.452, places=2)


class ConnectionTest(unittest.TestCase):
    def test_database_url_becomes_a_pg_connection_string(self):
        self.assertEqual(
            pg_connection("postgres://nl%40user:p%40ss@127.0.0.1:5433/nurserylink"),
            "PG:host='127.0.0.1' port='5433' dbname='nurserylink' user='nl@user' password='p@ss'",
        )


if __name__ == "__main__":
    unittest.main()
