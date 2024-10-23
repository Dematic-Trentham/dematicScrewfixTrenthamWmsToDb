/**
 * Times the execution of a given function and logs the duration.
 *
 * @template T - The return type of the function being timed.
 * @param {string} name - The name of the function being timed, used for logging purposes.
 * @param {() => T} func - The function to be timed.
 * @returns {T} - The result of the function execution.
 */
export function timeAFunction<T>(name: string, func: () => T): T {
  console.log(`Starting ${name}...`);
  const start = performance.now();
  const result = func();
  const end = performance.now();
  console.log(`${name} took ${(end - start).toFixed(2)} seconds.`);
  return result;
}
