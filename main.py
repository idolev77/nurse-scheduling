from prompt_toolkit.shortcuts import clear

import matcher
# This is a sample Python script.

# Press Ctrl+F5 to execute it or replace it with your code.
# Press Double Shift to search everywhere for classes, files, tool windows, actions, and settings.
def algorithm():
    my_graph = [[0, 16, 13, 0, 0, 0],
               [0, 0, 10, 12, 0, 0],
               [0, 0, 0, 0, 14, 0],
               [0, 0, 0, 0, 0, 20],
               [0, 0, 0, 0, 0, 0],
               [0, 0, 0, 0, 0, 0]]

    res_graph = matcher.Matcher(my_graph)
    result = res_graph.run_algorithm()
    res_graph.print_result(result[0].todense())


def print_hi(name):
    # Use a breakpoint in the code line below to debug your script.
    print(f'Hi, {name}')  # Press F9 to toggle the breakpoint.


# Press the green button in the gutter to run the script.
if __name__ == '__main__':
    algorithm()
    print_hi('PyCharm')

    clear()

# See PyCharm help at https://www.jetbrains.com/help/pycharm/
